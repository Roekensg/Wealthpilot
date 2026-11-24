#!/usr/bin/env python3
"""Produce a daily, adjusted-price research snapshot for the static WealthPilot app.

No fictional prices; failing symbols are omitted and reported. Intended for personal use.
"""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'data' / 'market.json'
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

# These are an explicitly curated *research universe*, not a claim that every
# instrument can be bought through every Belgian broker. "family" is used to
# avoid near-duplicate exposures dominating the top 10.
CATALOG = [
    # European-listed UCITS ETFs; quoted in EUR on these exchange listings.
    dict(ticker='VWCE.DE', name='Vanguard FTSE All-World', category='etf', family='global', focus='Wereldwijd aandelen', currency='EUR', description='Brede wereldspreiding, ontwikkelde én opkomende landen.', caution='Wereldaandelen kunnen jarenlang dalen.'),
    dict(ticker='IWDA.AS', name='iShares Core MSCI World', category='etf', family='global', focus='Ontwikkelde markten', currency='EUR', description='Gespreide aandelen-ETF voor ontwikkelde markten.', caution='Geen aparte directe dekking van opkomende markten.'),
    dict(ticker='SPYI.DE', name='SPDR MSCI ACWI IMI', category='etf', family='global', focus='Wereldwijd incl. small caps', currency='EUR', description='Brede exposure aan grote, middelgrote en kleine bedrijven.', caution='Sterk gecorreleerd met andere wereld-ETF’s.'),
    dict(ticker='SXR8.DE', name='iShares Core S&P 500', category='etf', family='usa', focus='Grote VS-bedrijven', currency='EUR', description='Volgt grote beursgenoteerde Amerikaanse bedrijven.', caution='Concentratie in VS en grote technologiebedrijven.'),
    dict(ticker='VUAA.DE', name='Vanguard S&P 500', category='etf', family='usa', focus='Grote VS-bedrijven', currency='EUR', description='Accumulatieve UCITS-ETF voor de S&P 500.', caution='Overlap met andere VS- en wereld-ETF’s.'),
    dict(ticker='IS3N.DE', name='iShares Core MSCI EM IMI', category='etf', family='emerging', focus='Opkomende markten', currency='EUR', description='Aanvullende spreiding over opkomende economieën.', caution='Verhoogd politiek en wisselkoersrisico.'),
    dict(ticker='IUSN.DE', name='iShares MSCI World Small Cap', category='etf', family='smallcap', focus='Kleine bedrijven', currency='EUR', description='Wereldwijde kleinere beursgenoteerde ondernemingen.', caution='Meer schommelingen dan brede large-cap ETF’s.'),
    dict(ticker='ZPRV.DE', name='SPDR USA Small Cap Value', category='etf', family='value', focus='VS small-cap value', currency='EUR', description='Kleine Amerikaanse ondernemingen met waardefactor.', caution='Cyclisch en relatief volatiel.'),
    dict(ticker='XDEM.DE', name='Xtrackers MSCI World Momentum', category='etf', family='factor', focus='Momentumfactor', currency='EUR', description='Selectie van ontwikkelde-marktaandelen op momentum.', caution='Factoren kunnen lange periodes achterblijven.'),
    dict(ticker='EXSA.DE', name='iShares STOXX Europe 600', category='etf', family='europe', focus='Europese aandelen', currency='EUR', description='Spreiding over grote, middelgrote en kleine EU-bedrijven.', caution='Regionale concentratie op Europa.'),
    # Fixed-income UCITS ETFs are an indirect way of tracking bonds.
    dict(ticker='EUNA.DE', name='iShares Core Global Aggregate Bond', category='obligaties', family='globalbond', focus='Wereldwijde obligaties', currency='EUR', description='Breed gespreide investment-grade obligaties.', caution='Renteverhogingen kunnen obligatiekoersen drukken.'),
    dict(ticker='VAGF.DE', name='Vanguard Global Aggregate Bond', category='obligaties', family='globalbond', focus='Wereldwijde obligaties', currency='EUR', description='Gespreide obligaties als defensievere portefeuillebouwsteen.', caution='Koers-, rente- en kredietrisico blijven bestaan.'),
    dict(ticker='IEAC.AS', name='iShares Core Euro Corporate Bond', category='obligaties', family='corporatebond', focus='Europese bedrijfsobligaties', currency='EUR', description='Obligaties van Europese bedrijven met kredietkwaliteit.', caution='Bedrijfsrisico en rentegevoeligheid.'),
    dict(ticker='IBCI.DE', name='iShares Euro Inflation Linked Govt Bond', category='obligaties', family='inflationbond', focus='Inflatiegekoppelde obligaties', currency='EUR', description='Euro-obligaties waarvan kasstromen aan inflatie gekoppeld zijn.', caution='Kan toch dalen bij hogere reële rente.'),
    # ETC: physical gold exposure; not a diversified ETF or a stock.
    dict(ticker='4GLD.DE', name='Xetra-Gold', category='goud', family='gold', focus='Goud (ETC)', currency='EUR', description='Beursgenoteerde blootstelling aan goud.', caution='Goud keert geen dividend of rente uit; check productstructuur.'),
    # Property equities / REITs.
    dict(ticker='O', name='Realty Income', category='vastgoed', family='reit', focus='REIT · winkels/vastgoed', currency='USD', description='Beursgenoteerd vastgoedbedrijf met huurinkomsten.', caution='Rentegevoeligheid, schulden en vastgoedconcentratie.'),
    dict(ticker='PLD', name='Prologis', category='vastgoed', family='reit', focus='REIT · logistiek', currency='USD', description='Logistiek vastgoed en distributiecentra.', caution='Economische cyclus en vastgoedwaarderingen.'),
    dict(ticker='VICI', name='VICI Properties', category='vastgoed', family='reit', focus='REIT · recreatie', currency='USD', description='Vastgoed dat onder andere aan leisure-exploitanten verhuurd wordt.', caution='Concentratie in huurders en vastgoedsector.'),
    dict(ticker='WDP.BR', name='Warehouses De Pauw', category='vastgoed', family='reit', focus='Belgisch logistiek vastgoed', currency='EUR', description='Beursgenoteerde speler in logistiek vastgoed.', caution='Rentegevoeligheid en vastgoedfinanciering.'),
    # Individual equities: these increase concentration relative to an ETF.
    dict(ticker='ASML.AS', name='ASML', category='aandelen', family='semis', focus='Halfgeleiderapparatuur', currency='EUR', description='Belangrijke leverancier in chipproductie.', caution='Cyclische chipsector, exportregels en waardering.'),
    dict(ticker='SAP.DE', name='SAP', category='aandelen', family='software', focus='Enterprise software', currency='EUR', description='Grote Europese softwarespecialist.', caution='Concurrentie en hoge groeiverwachtingen.'),
    dict(ticker='MC.PA', name='LVMH', category='aandelen', family='consumer', focus='Luxegoederen', currency='EUR', description='Internationale luxe- en merkenportefeuille.', caution='Consumentenvertrouwen en vraag uit Azië.'),
    dict(ticker='SU.PA', name='Schneider Electric', category='aandelen', family='industrials', focus='Elektrificatie en energiebeheer', currency='EUR', description='Industrie en software rond elektrificatie.', caution='Cyclische investeringen en waardering.'),
    dict(ticker='AIR.PA', name='Airbus', category='aandelen', family='industrials', focus='Luchtvaart', currency='EUR', description='Europese vliegtuigbouwer.', caution='Productieproblemen en macro-economische schokken.'),
    dict(ticker='ABI.BR', name='AB InBev', category='aandelen', family='consumer', focus='Dranken', currency='EUR', description='Internationale consumentengoederenproducent.', caution='Schuldpositie, valuta en grondstofkosten.'),
    dict(ticker='UCB.BR', name='UCB', category='aandelen', family='health', focus='Geneesmiddelen', currency='EUR', description='Belgische biofarmaceutische onderneming.', caution='Onderzoeksrisico en afhankelijkheid van geneesmiddelen.'),
    dict(ticker='MSFT', name='Microsoft', category='aandelen', family='software', focus='Software en cloud', currency='USD', description='Enterprise software, cloud en AI-infrastructuur.', caution='Hoge verwachtingen, regelgeving en AI-kapitaaluitgaven.'),
    dict(ticker='GOOGL', name='Alphabet', category='aandelen', family='internet', focus='Zoekdiensten en cloud', currency='USD', description='Advertentieplatforms en cloudactiviteiten.', caution='Concurrentie, AI en mededingingsrecht.'),
    dict(ticker='AMZN', name='Amazon', category='aandelen', family='internet', focus='E-commerce en cloud', currency='USD', description='Webhandel, cloud en logistiek.', caution='Marges, investeringskosten en regelgeving.'),
    dict(ticker='NVDA', name='NVIDIA', category='aandelen', family='semis', focus='AI-chips', currency='USD', description='Chips en software voor versneld rekenen.', caution='Zeer cyclisch en gevoelig voor waardering en vraag.'),
    dict(ticker='AAPL', name='Apple', category='aandelen', family='consumertech', focus='Consumententechnologie', currency='USD', description='Hardware, ecosysteem en diensten.', caution='Concentratie in iPhone en productcycli.'),
    dict(ticker='V', name='Visa', category='aandelen', family='payments', focus='Betalingsnetwerk', currency='USD', description='Wereldwijd elektronisch betalingsnetwerk.', caution='Regelgeving en betalingsconcurrentie.'),
    dict(ticker='BRK-B', name='Berkshire Hathaway B', category='aandelen', family='conglomerate', focus='Gespreid conglomeraat', currency='USD', description='Breed conglomeraat van bedrijven en beleggingen.', caution='Ondanks spreiding nog steeds één aandeel.'),
    dict(ticker='COST', name='Costco', category='aandelen', family='consumer', focus='Retail', currency='USD', description='Ledenformule in grootschalige detailhandel.', caution='Waarderingsrisico en winstgroei.'),
    dict(ticker='TSM', name='TSMC ADR', category='aandelen', family='semis', focus='Chipproductie', currency='USD', description='Belangrijke contractproducent van geavanceerde chips.', caution='Geopolitiek risico rond Taiwan.'),
    dict(ticker='META', name='Meta Platforms', category='aandelen', family='internet', focus='Sociale platformen', currency='USD', description='Wereldwijde sociale netwerken en advertenties.', caution='Regelgeving, advertentiecyclus en AI-investeringen.'),
    dict(ticker='JNJ', name='Johnson & Johnson', category='aandelen', family='health', focus='Gezondheidszorg', currency='USD', description='Internationale gezondheidszorgonderneming.', caution='Juridische en medische productrisico’s.'),
    dict(ticker='PG', name='Procter & Gamble', category='aandelen', family='consumer', focus='Dagelijkse consumptie', currency='USD', description='Merken in dagelijkse consumentengoederen.', caution='Beperktere groei en waarderingsrisico.'),
    # Speculative digital assets: included for comparison; no promises of value.
    dict(ticker='BTC-EUR', name='Bitcoin', category='crypto', family='crypto', focus='Digitale activa', currency='EUR', description='Digitale schaarste zonder bedrijfswinst of kasstromen.', caution='Extreme schommelingen en kans op groot verlies.'),
    dict(ticker='ETH-EUR', name='Ethereum', category='crypto', family='crypto', focus='Digitale activa', currency='EUR', description='Cryptonetwerk met veel applicaties.', caution='Technologisch, regulatorisch en koersrisico.'),
]


def safe_float(value, places=3):
    try:
        value = float(value)
        return round(value, places) if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def metric_return(prices: pd.Series, days: int):
    if len(prices) <= days:
        return None
    denominator = prices.iloc[-days - 1]
    if not denominator or not math.isfinite(float(denominator)):
        return None
    return safe_float((prices.iloc[-1] / denominator - 1) * 100)


def series_from(frame: pd.DataFrame, ticker: str) -> pd.Series | None:
    try:
        if isinstance(frame.columns, pd.MultiIndex):
            # group_by=ticker normally generates (ticker, price field)
            if ticker in frame.columns.get_level_values(0):
                sub = frame[ticker]
                close = sub['Close']
            elif ticker in frame.columns.get_level_values(1):
                close = frame['Close'][ticker]
            else:
                return None
        else:
            close = frame['Close']
        close = pd.to_numeric(close, errors='coerce').dropna()
        close = close[close > 0]
        return close if len(close) > 0 else None
    except (KeyError, TypeError, IndexError):
        return None


def get_quotes(download_fn=yf.download) -> tuple[dict[str, pd.Series], list[str]]:
    tickers = [entry['ticker'] for entry in CATALOG] + ['EURUSD=X']
    quotes = {}
    failure = []
    try:
        frame = download_fn(tickers=tickers, period='2y', interval='1d', group_by='ticker', auto_adjust=True, progress=False, threads=True, timeout=25)
        for ticker in tickers:
            close = series_from(frame, ticker)
            if close is not None and len(close) >= (5 if ticker == 'EURUSD=X' else 255):
                quotes[ticker] = close
            else:
                failure.append(ticker)
    except Exception as exc:
        logging.warning('Bulk download failed: %s', exc)
        failure = tickers[:]
    return quotes, failure


def build_snapshot(quotes: dict[str, pd.Series], generated_at: datetime | None = None):
    generated_at = generated_at or datetime.now(timezone.utc)
    fxseries = quotes.get('EURUSD=X')
    eurusd = float(fxseries.iloc[-1]) if fxseries is not None else None
    items = []
    for entry in CATALOG:
        ticker = entry['ticker']
        s = quotes.get(ticker)
        if s is None or len(s) < 255:
            continue
        current = float(s.iloc[-1])
        daily_returns = s.pct_change().replace([np.inf, -np.inf], np.nan).dropna().iloc[-126:]
        annual_volatility = safe_float(float(daily_returns.std()) * (252 ** .5) * 100) if len(daily_returns) > 50 else None
        highs = s.iloc[-252:].cummax()
        current_dd = safe_float((current / float(highs.iloc[-1]) - 1) * 100)
        avg = float(s.iloc[-200:].mean())
        trend = safe_float((current / avg - 1) * 100)
        price_eur = current / eurusd if entry['currency'] == 'USD' and eurusd else (current if entry['currency'] == 'EUR' else None)
        sample = s.iloc[-253::max(1, len(s.iloc[-253:]) // 55)]
        # Ensure the final point is present in the sparkline
        values = [safe_float(p, 4) for p in sample.tolist()]
        if not values or values[-1] != safe_float(current, 4):
            values.append(safe_float(current, 4))
        items.append({
            **entry,
            'price': safe_float(current, 4),
            'priceEUR': safe_float(price_eur, 4),
            'change1m': metric_return(s, 21),
            'change3m': metric_return(s, 63),
            'change6m': metric_return(s, 126),
            'change12m': metric_return(s, 252),
            'volatility': annual_volatility,
            'drawdown': current_dd,
            'above200d': trend,
            'history': [v for v in values if v is not None],
            'tradingDay': str(s.index[-1].date()),
            'historyPoints': len(s),
        })
    valid_days = [x['tradingDay'] for x in items if x['category'] != 'crypto']
    snapshot = {
        'schemaVersion': 1,
        'generatedAt': generated_at.isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'latestTradingDay': max(valid_days) if valid_days else None,
        'source': 'Yahoo Finance via yfinance; dagelijkse (aangepaste) slotkoersen, mogelijk vertraagd',
        'fx': {'EURUSD': safe_float(eurusd, 5)},
        'coverage': {'requested': len(CATALOG), 'valid': len(items), 'failed': [x['ticker'] for x in CATALOG if x['ticker'] not in {a['ticker'] for a in items}]},
        'instruments': items,
    }
    return snapshot


def run():
    quotes, failed = get_quotes()
    snapshot = build_snapshot(quotes)
    logging.info('Coverage %s/%s (errors %s)', snapshot['coverage']['valid'], len(CATALOG), len(failed))
    if snapshot['coverage']['valid'] < 8:
        raise SystemExit('Not enough reliable quotes; refusing to overwrite the current snapshot')
    OUTPUT.parent.mkdir(exist_ok=True)
    tmp = OUTPUT.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding='utf8')
    tmp.replace(OUTPUT)
    logging.info('Updated %s on %s', OUTPUT, snapshot['latestTradingDay'])


if __name__ == '__main__':
    run()
