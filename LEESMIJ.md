# WealthPilot — je beleggingsradar op de iPhone

WealthPilot is een **installatieklare webapp (PWA)** met een daggebaseerde top 10 van interessante beleggingen om verder te onderzoeken. Het is geen iOS-app uit de App Store en koopt geen beleggingen voor je. Je kunt hem na publicatie met Safari aan het beginscherm toevoegen.

## Dit zit erin

- 40 kandidaten: Europese UCITS-ETF's, individuele aandelen, obligatie-ETF's, beursgenoteerd vastgoed, goud en crypto.
- Gepersonaliseerde top 10 met risicoprofiel **defensief, gebalanceerd of groeigericht**, plus een horizon van 5, 10, 15 of 20 jaar.
- Dagelijkse slotkoersen, 12-maandsgrafieken, rendementen, volatiliteit en drawdowns, **zodra de koersfeed succesvol gedraaid heeft**.
- Bewaarlijst op het toestel, filteren, zoeken en details per belegging.
- Een hypothetische vermogenssimulator met maandelijkse inleg en verschillende rendementspercentages.
- Offline-ondersteuning voor de laatst opgehaalde gegevens bij normale installatie.

## Installeren en koersen automatisch laten verversen

1. Maak een **gratis GitHub-account** op https://github.com als je er nog geen hebt.
2. Maak een nieuwe publieke repository, bijvoorbeeld `wealthpilot`, met **main** als hoofdbranch.
3. Pak `WealthPilot.zip` uit op een computer en upload **de inhoud van de map** naar de repository (ook de verborgen `.github/workflows/wealthpilot.yml`). Je kunt dit het eenvoudigst via GitHub Desktop / Git of met **Add file → Upload files** doen; voor de workflow kan het nodig zijn de mappen in de webinterface afzonderlijk te maken. Upload niet alleen het zipbestand.
4. Open in de repository **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → WealthPilot · beursdata en iPhone-app → Run workflow** om de eerste analyse en publicatie te starten. Het workflowbestand moet op de standaardbranch `main` staan. Als GitHub om toestemming vraagt, zet Actions aan.
6. Open na een **succesvolle deployment** de weergegeven Pages-website (normaliter `https://JOUW-GEBRUIKERSNAAM.github.io/wealthpilot/`). Controleer of de status een echte beursdag toont en het aantal instrumenten met koersen groter is dan nul.
7. Open die link op je **iPhone met Safari**. Tik op **Deel → Zet op beginscherm → Voeg toe**. Vanaf nu open je WealthPilot via zijn icoon.

Elke werkdag om **23:27 UTC** probeert GitHub Actions de slotkoersen te vernieuwen en automatisch opnieuw te publiceren. GitHub kan taken vertragen; een API kan uitvallen of koersgegevens kunnen ontbreken. Een browser-herlaadactie controleert de **laatste gepubliceerde snapshot** en vraagt geen realtime-beurskoersen op. De functie *Run workflow* maakt een handmatige nieuwe data-run mogelijk.

**Niet vergeten:** GitHub kan geplande workflows in inactieve repositories na langere tijd automatisch uitschakelen. Controleer af en toe of de app nog een recente beursdatum toont. Bij mislukte data-ophaling behoudt de repository de laatste **succesvol gecommitte** koerssnapshot. Als de eerste ophaling mislukt, is er voorlopig enkel een **niet-gerangschikte voorbeeldselectie** zichtbaar.

## Hoe worden de scores berekend?

Dit is een indicatieve *interessescore*, geen voorspelling en geen koopadvies. Het algoritme gebruikt:

- koersontwikkeling over 6 en 12 maanden;
- de verhouding tot het 200-daags gemiddelde;
- recente volatiliteit en de daling vanaf de 12-maandstop;
- een beperkte bonus voor een terugval binnen een bestaande opwaartse trend;
- de gekozen risico-instelling en horizon;
- spreidingsregels om sterk overlappende ETF's en sectoren te beperken.

**Niet opgenomen:** actuele waarderingsratio's, kwartaalresultaten, intrinsieke waarde, fondskosten, schulden, nieuws en diepgaande fundamentele analyses. Een score van 90 betekent **niet** een verwachte winst van 90%, 90% zekerheid, of een professioneel koopsignaal.

## Belgische beleggers

Controleer bij elke ETF/ETC het **ISIN**, de KID, accumulatie versus distributie, wisselkoers, brokerbeschikbaarheid, taksen en eventuele heffingen. UCITS-ETF's staan in het universum omdat ze vaak toegankelijker zijn voor EU-particuliere beleggers dan Amerikaanse ETF's. Crypto is bijzonder speculatief. De app werkt niet met je brokergegevens en houdt geen aankoopposities bij.

## Bron en privacy

- Python haalt data via `yfinance` op bij Yahoo Finance. Dit is een derdepartijbron voor persoonlijk onderzoek; controleer toepasselijke gebruiksvoorwaarden.
- De GitHub Actions-workflow publiceert de statische site en de nieuwste JSON-snapshot. Geen betaalde API-key nodig zolang de gekozen route werkt.
- Favorieten, risicoprofiel en de bedragen voor de simulator blijven via `localStorage` **op je eigen apparaat**. Bij wissen van browsergegevens of andere toestellen zijn ze weg.
- De app stuurt geen orders en is **geen financieel advies**.

## Problemen oplossen

**'Nog geen echte beursgegevens'**: kijk bij GitHub → Actions of de workflow een groene uitvoering heeft en of de stap 'Dagelijkse marktanalyse bijwerken' daadwerkelijk geslaagd is. Het script weigert fictieve prijzen of een snapshot met minder dan 8 geldige instrumenten te publiceren.

**De app toont oude data**: druk op vernieuwen, kijk op de nieuwste beursdag, en controleer GitHub → Actions. Bij offline gebruik toont de PWA eventueel de laatst succesvol opgehaalde data.

**Ik zie geen app-icoon**: open de Pages-link in Safari (niet vanuit een ingebedde browser) en gebruik **Zet op beginscherm**.

**Scores lijken vreemd**: kijk op het tabblad *Inzicht* voor de beperkingen. Historische koerssterkte is niet hetzelfde als goedkoop gewaardeerd. Gebruik de lijst als onderzoeksstartpunt en controleer zelf waardering en risico.
