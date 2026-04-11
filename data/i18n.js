(function () {
  'use strict';

  var STORAGE_KEY = 'wassersport-language';
  var COOKIE_KEY = 'locale';
  var DEFAULT_LANGUAGE = 'de';
  var SUPPORTED_LANGUAGES = ['de', 'en', 'pl', 'nl'];
  var LANGUAGE_EVENT = 'wassersport:languagechange';

  var TRANSLATIONS = {
    de: {
      siteName: 'Havelkanal Wassersport',
      language: {
        label: 'Sprache',
        switcherAria: 'Sprache wechseln',
      },
      common: {
        logoAlt: 'Logo von Havelkanal Wassersport',
      },
      nav: {
        activities: 'Aktivitäten',
        about: 'Über uns',
        calendar: 'Kalender',
        login: 'Anmelden',
        join: 'Mitmachen',
        logout: 'Abmelden',
      },
      meta: {
        homeTitle: 'Havelkanal Wassersport - Sport, Spass und Gruen',
        homeDescription: 'Entdecke Motorboot, Paddeln, Drachenboot und SUP am Havelkanal.',
        loginTitle: 'Anmelden - Havelkanal Wassersport',
        forgotTitle: 'Passwort vergessen - Havelkanal Wassersport',
        resetTitle: 'Neues Passwort - Havelkanal Wassersport',
        membersTitle: 'Mitglieder - Havelkanal Wassersport',
      },
      home: {
        banner: {
          label: 'Hafenmeister Ankündigungen:',
          loading: 'Lade Ankündigungen...',
          empty: 'Keine Ankündigungen.',
        },
        hero: {
          imageAlt: 'Gruener Kanal mit Booten und Paddlern',
          title: 'Sport, Spass und <span class="accent">grün</span> am Havelkanal.',
          text: 'Wähle Deinen Sport: Motorboot, Paddeln, Drachenboot oder SUP. Klares Wasser, freundliche Menschen und ein schneller Einstieg.',
          calendarCta: 'Kalender',
          exploreCta: 'Aktivitäten erkunden',
        },
        activities: {
          title: 'Wähle Deinen Sport',
          subtitle: 'Allein, im Team oder im Verein.',
          motorboatAlt: 'Motorboot Symbol',
          motorboatTitle: 'Motorboot',
          motorboatText: 'Liegeplatz, Training und sichere Ausfahrten für Motorboot-Mitglieder.',
          motorboatMeta1: 'Bis zu 12 Meter',
          motorboatMeta2: 'Training und Sicherheit',
          motorboatCta: 'Motorboot ansehen',
          paddlingAlt: 'Paddeln Symbol',
          paddlingTitle: 'Paddeln',
          paddlingText: 'Entspannte Touren und gemeinsame Ausfahrten auf Havelkanal und Havel.',
          paddlingMeta1: '1er, 2er, 3er',
          paddlingMeta2: 'Touren fuer jedes Level',
          paddlingCta: 'Paddeln ansehen',
          dragonAlt: 'Drachenboot Symbol',
          dragonTitle: 'Drachenboot',
          dragonText: 'Teamtraining, Wettkampf und Vereinsleben fuer Mannschaften mit Rhythmus.',
          dragonMeta1: '10-16 Personen',
          dragonMeta2: 'Regelmaessige Events',
          dragonCta: 'Drachenboot ansehen',
          supAlt: 'SUP Symbol',
          supTitle: 'Stand-up Paddeln',
          supText: 'Balance, Technik und freie Zeit auf dem Wasser fuer Einsteiger und Erfahrene.',
          supMeta1: 'Solo oder Kurs',
          supMeta2: 'Boards vor Ort',
          supCta: 'SUP ansehen',
        },
        about: {
          title: 'Warum Havelkanal?',
          feature1: 'Klares, sauberes Wasser',
          feature2: 'Ruhiges Gewässer mit wenig Schiffsverkehr',
          feature3: 'Gute Anbindung zur Havel und nach Berlin',
          feature4: 'Konstante Wassertiefe und wenig Strömung',
        },
        calendar: {
          title: 'Veranstaltungskalender',
          subtitle: 'Alle Termine auf einen Blick.',
          prevMonthAria: 'Vorheriger Monat',
          nextMonthAria: 'Nächster Monat',
          gridAriaLabel: 'Kalender',
          emptySelection: 'Wähle einen Tag, um Termine zu sehen.',
          emptyDay: 'Keine Termine an diesem Tag.',
          emptyUpcoming: 'Keine bevorstehenden Termine.',
          legend: 'Termin vorhanden',
          upcomingLabel: 'Nächste Termine:',
          whenLabel: 'Datum',
          timeLabel: 'Uhrzeit',
          locationLabel: 'Ort',
          downloadIcs: 'Termin herunterladen (.ics)',
        },
      },
      login: {
        heading: 'Mitgliederbereich',
        subtitle: 'Bitte melde Dich an, um fortzufahren.',
        username: 'Benutzername',
        password: 'Passwort',
        submit: 'Anmelden',
        loading: 'Einen Moment...',
        forgot: 'Passwort vergessen?',
        failed: 'Anmeldung fehlgeschlagen.',
        network: 'Netzwerkfehler. Bitte erneut versuchen.',
      },
      forgot: {
        heading: 'Passwort vergessen',
        subtitle: 'Gib Deine E-Mail-Adresse ein. Falls ein Konto existiert, erhältst Du einen Reset-Link.',
        email: 'E-Mail-Adresse',
        submit: 'Reset-Link senden',
        loading: 'Einen Moment...',
        back: 'Zurück zur Anmeldung',
        sendError: 'Fehler beim Senden.',
        network: 'Netzwerkfehler. Bitte erneut versuchen.',
      },
      reset: {
        heading: 'Neues Passwort',
        subtitle: 'Wähle ein neues Passwort mit mindestens 8 Zeichen.',
        newPassword: 'Neues Passwort',
        confirmPassword: 'Passwort bestätigen',
        submit: 'Passwort speichern',
        loading: 'Einen Moment...',
        success: 'Passwort erfolgreich geändert.',
        back: 'Zur Anmeldung',
        invalidLink: 'Ungültiger Link. Bitte fordere einen neuen Reset-Link an.',
        mismatch: 'Passwörter stimmen nicht überein.',
        tooShort: 'Passwort muss mindestens 8 Zeichen lang sein.',
        saveError: 'Fehler beim Speichern.',
        network: 'Netzwerkfehler. Bitte erneut versuchen.',
      },
      members: {
        heading: 'Mitgliederbereich',
        welcomePlaceholder: 'Willkommen!',
        welcome: 'Willkommen, {username}!',
        listHeading: 'Mitgliederliste',
        name: 'Name',
        sport: 'Sport',
        since: 'Mitglied seit',
        loading: 'Lade Daten...',
        empty: 'Keine Mitgliederdaten verfügbar.',
      },
    },
    en: {
      siteName: 'Havelkanal Watersports',
      language: {
        label: 'Language',
        switcherAria: 'Switch language',
      },
      common: {
        logoAlt: 'Havelkanal Watersports logo',
      },
      nav: {
        activities: 'Activities',
        about: 'About us',
        calendar: 'Calendar',
        login: 'Login',
        join: 'Join in',
        logout: 'Log out',
      },
      meta: {
        homeTitle: 'Havelkanal Watersports - Sport, fun and green',
        homeDescription: 'Discover motorboats, paddling, dragon boats and stand-up paddleboarding on the Havel Canal.',
        loginTitle: 'Login - Havelkanal Watersports',
        forgotTitle: 'Forgot password - Havelkanal Watersports',
        resetTitle: 'New password - Havelkanal Watersports',
        membersTitle: 'Members - Havelkanal Watersports',
      },
      home: {
        banner: {
          label: 'Harbourmaster announcements:',
          loading: 'Loading announcements...',
          empty: 'No announcements.',
        },
        hero: {
          imageAlt: 'Green canal with boats and paddlers',
          title: 'Sport, fun and <span class="accent">green</span> on the Havel Canal.',
          text: 'Choose your sport: motorboat, paddling, dragon boat or SUP. Clear water, friendly people and an easy way to get started.',
          calendarCta: 'Calendar',
          exploreCta: 'Explore activities',
        },
        activities: {
          title: 'Choose your sport',
          subtitle: 'Solo, as a team or in the club.',
          motorboatAlt: 'Motorboat icon',
          motorboatTitle: 'Motorboat',
          motorboatText: 'Moorings, training and safe outings for motorboat members.',
          motorboatMeta1: 'Up to 12 metres',
          motorboatMeta2: 'Training and safety',
          motorboatCta: 'View motorboat',
          paddlingAlt: 'Paddling icon',
          paddlingTitle: 'Paddling',
          paddlingText: 'Relaxed tours and group outings on the Havel Canal and the Havel.',
          paddlingMeta1: 'Single, double, triple',
          paddlingMeta2: 'Tours for every level',
          paddlingCta: 'View paddling',
          dragonAlt: 'Dragon boat icon',
          dragonTitle: 'Dragon boat',
          dragonText: 'Team training, competition and club life for crews with rhythm.',
          dragonMeta1: '10-16 people',
          dragonMeta2: 'Regular events',
          dragonCta: 'View dragon boat',
          supAlt: 'SUP icon',
          supTitle: 'Stand-up paddleboarding',
          supText: 'Balance, technique and time on the water for beginners and experienced riders.',
          supMeta1: 'Solo or class',
          supMeta2: 'Boards available',
          supCta: 'View SUP',
        },
        about: {
          title: 'Why Havelkanal?',
          feature1: 'Clear, clean water',
          feature2: 'Calm water with little boat traffic',
          feature3: 'Easy access to the Havel and Berlin',
          feature4: 'Consistent depth and very little current',
        },
        calendar: {
          title: 'Event calendar',
          subtitle: 'All upcoming dates at a glance.',
          prevMonthAria: 'Previous month',
          nextMonthAria: 'Next month',
          gridAriaLabel: 'Calendar',
          emptySelection: 'Choose a day to see events.',
          emptyDay: 'No events on this day.',
          emptyUpcoming: 'No upcoming events.',
          legend: 'Event available',
          upcomingLabel: 'Next events:',
          whenLabel: 'Date',
          timeLabel: 'Time',
          locationLabel: 'Location',
          downloadIcs: 'Download event (.ics)',
        },
      },
      login: {
        heading: 'Members area',
        subtitle: 'Please sign in to continue.',
        username: 'Username',
        password: 'Password',
        submit: 'Login',
        loading: 'One moment...',
        forgot: 'Forgot your password?',
        failed: 'Login failed.',
        network: 'Network error. Please try again.',
      },
      forgot: {
        heading: 'Forgot password',
        subtitle: 'Enter your email address. If an account exists, you will receive a reset link.',
        email: 'Email address',
        submit: 'Send reset link',
        loading: 'One moment...',
        back: 'Back to login',
        sendError: 'Unable to send request.',
        network: 'Network error. Please try again.',
      },
      reset: {
        heading: 'New password',
        subtitle: 'Choose a new password with at least 8 characters.',
        newPassword: 'New password',
        confirmPassword: 'Confirm password',
        submit: 'Save password',
        loading: 'One moment...',
        success: 'Password updated successfully.',
        back: 'Back to login',
        invalidLink: 'Invalid link. Please request a new reset link.',
        mismatch: 'Passwords do not match.',
        tooShort: 'Password must be at least 8 characters long.',
        saveError: 'Unable to save the password.',
        network: 'Network error. Please try again.',
      },
      members: {
        heading: 'Members area',
        welcomePlaceholder: 'Welcome!',
        welcome: 'Welcome, {username}!',
        listHeading: 'Member list',
        name: 'Name',
        sport: 'Sport',
        since: 'Member since',
        loading: 'Loading data...',
        empty: 'No member data available.',
      },
    },
    pl: {
      siteName: 'Havelkanal Sporty Wodne',
      language: {
        label: 'Język',
        switcherAria: 'Zmień język',
      },
      common: {
        logoAlt: 'Logo Havelkanal Sporty Wodne',
      },
      nav: {
        activities: 'Aktywności',
        about: 'O nas',
        calendar: 'Kalendarz',
        login: 'Zaloguj się',
        join: 'Dołącz',
        logout: 'Wyloguj się',
      },
      meta: {
        homeTitle: 'Havelkanal Sporty Wodne - Sport, zabawa i zieleń',
        homeDescription: 'Odkryj motorówki, kajakarstwo, smocze łodzie i SUP na kanale Haweli.',
        loginTitle: 'Logowanie - Havelkanal Sporty Wodne',
        forgotTitle: 'Zapomniane hasło - Havelkanal Sporty Wodne',
        resetTitle: 'Nowe hasło - Havelkanal Sporty Wodne',
        membersTitle: 'Członkowie - Havelkanal Sporty Wodne',
      },
      home: {
        banner: {
          label: 'Ogłoszenia bosmana:',
          loading: 'Ładowanie ogłoszeń...',
          empty: 'Brak ogłoszeń.',
        },
        hero: {
          imageAlt: 'Zielony kanał z łódkami i kajakarzami',
          title: 'Sport, zabawa i <span class="accent">zieleń</span> na kanale Haweli.',
          text: 'Wybierz swój sport: motorówka, kajak, smocza łódź lub SUP. Czysta woda, przyjaźni ludzie i szybki start.',
          calendarCta: 'Kalendarz',
          exploreCta: 'Odkryj aktywności',
        },
        activities: {
          title: 'Wybierz swój sport',
          subtitle: 'Samodzielnie, w zespole lub w klubie.',
          motorboatAlt: 'Ikona motorówki',
          motorboatTitle: 'Motorówka',
          motorboatText: 'Miejsce cumowania, szkolenia i bezpieczne rejsy dla członków z motorówkami.',
          motorboatMeta1: 'Do 12 metrów',
          motorboatMeta2: 'Szkolenia i bezpieczeństwo',
          motorboatCta: 'Zobacz motorówki',
          paddlingAlt: 'Ikona kajakarstwa',
          paddlingTitle: 'Kajakarstwo',
          paddlingText: 'Spokojne wycieczki i wspólne rejsy po kanale Haweli i rzece Haweli.',
          paddlingMeta1: 'Jedynki, dwójki, trójki',
          paddlingMeta2: 'Wycieczki dla każdego poziomu',
          paddlingCta: 'Zobacz kajaki',
          dragonAlt: 'Ikona smoczej łodzi',
          dragonTitle: 'Smocza łódź',
          dragonText: 'Trening zespołowy, zawody i życie klubowe dla załóg z rytmem.',
          dragonMeta1: '10–16 osób',
          dragonMeta2: 'Regularne wydarzenia',
          dragonCta: 'Zobacz smocze łodzie',
          supAlt: 'Ikona SUP',
          supTitle: 'Stand-up paddleboarding',
          supText: 'Równowaga, technika i czas na wodzie dla początkujących i doświadczonych.',
          supMeta1: 'Solo lub kurs',
          supMeta2: 'Deski na miejscu',
          supCta: 'Zobacz SUP',
        },
        about: {
          title: 'Dlaczego Havelkanal?',
          feature1: 'Czysta, przejrzysta woda',
          feature2: 'Spokojna woda z małym ruchem łodzi',
          feature3: 'Dobry dostęp do rzeki Haweli i Berlina',
          feature4: 'Stała głębokość i bardzo słaby prąd',
        },
        calendar: {
          title: 'Kalendarz wydarzeń',
          subtitle: 'Wszystkie terminy w jednym miejscu.',
          prevMonthAria: 'Poprzedni miesiąc',
          nextMonthAria: 'Następny miesiąc',
          gridAriaLabel: 'Kalendarz',
          emptySelection: 'Wybierz dzień, aby zobaczyć wydarzenia.',
          emptyDay: 'Brak wydarzeń w tym dniu.',
          emptyUpcoming: 'Brak nadchodzących wydarzeń.',
          legend: 'Dostępne wydarzenie',
          upcomingLabel: 'Nadchodzące wydarzenia:',
          whenLabel: 'Data',
          timeLabel: 'Godzina',
          locationLabel: 'Miejsce',
          downloadIcs: 'Pobierz wydarzenie (.ics)',
        },
      },
      login: {
        heading: 'Strefa członków',
        subtitle: 'Zaloguj się, aby kontynuować.',
        username: 'Nazwa użytkownika',
        password: 'Hasło',
        submit: 'Zaloguj się',
        loading: 'Chwileczkę...',
        forgot: 'Nie pamiętasz hasła?',
        failed: 'Logowanie nie powiodło się.',
        network: 'Błąd sieci. Spróbuj ponownie.',
      },
      forgot: {
        heading: 'Zapomniane hasło',
        subtitle: 'Podaj swój adres e-mail. Jeśli konto istnieje, otrzymasz link do resetowania hasła.',
        email: 'Adres e-mail',
        submit: 'Wyślij link resetujący',
        loading: 'Chwileczkę...',
        back: 'Powrót do logowania',
        sendError: 'Nie można wysłać żądania.',
        network: 'Błąd sieci. Spróbuj ponownie.',
      },
      reset: {
        heading: 'Nowe hasło',
        subtitle: 'Wybierz nowe hasło składające się z co najmniej 8 znaków.',
        newPassword: 'Nowe hasło',
        confirmPassword: 'Potwierdź hasło',
        submit: 'Zapisz hasło',
        loading: 'Chwileczkę...',
        success: 'Hasło zostało pomyślnie zmienione.',
        back: 'Powrót do logowania',
        invalidLink: 'Nieprawidłowy link. Poproś o nowy link resetujący.',
        mismatch: 'Hasła nie są zgodne.',
        tooShort: 'Hasło musi mieć co najmniej 8 znaków.',
        saveError: 'Nie można zapisać hasła.',
        network: 'Błąd sieci. Spróbuj ponownie.',
      },
      members: {
        heading: 'Strefa członków',
        welcomePlaceholder: 'Witaj!',
        welcome: 'Witaj, {username}!',
        listHeading: 'Lista członków',
        name: 'Imię i nazwisko',
        sport: 'Sport',
        since: 'Członek od',
        loading: 'Ładowanie danych...',
        empty: 'Brak danych o członkach.',
      },
    },
    nl: {
      siteName: 'Havelkanal Watersport',
      language: {
        label: 'Taal',
        switcherAria: 'Taal wisselen',
      },
      common: {
        logoAlt: 'Logo van Havelkanal Watersport',
      },
      nav: {
        activities: 'Activiteiten',
        about: 'Over ons',
        calendar: 'Kalender',
        login: 'Inloggen',
        join: 'Meedoen',
        logout: 'Uitloggen',
      },
      meta: {
        homeTitle: 'Havelkanal Watersport - Sport, plezier en groen',
        homeDescription: 'Ontdek motorboot, kanoën, drakenboot en SUP op het Havel-kanaal.',
        loginTitle: 'Inloggen - Havelkanal Watersport',
        forgotTitle: 'Wachtwoord vergeten - Havelkanal Watersport',
        resetTitle: 'Nieuw wachtwoord - Havelkanal Watersport',
        membersTitle: 'Leden - Havelkanal Watersport',
      },
      home: {
        banner: {
          label: 'Mededelingen havenmeester:',
          loading: 'Mededelingen laden...',
          empty: 'Geen mededelingen.',
        },
        hero: {
          imageAlt: 'Groen kanaal met boten en kaarsers',
          title: 'Sport, plezier en <span class="accent">groen</span> op het Havel-kanaal.',
          text: 'Kies jouw sport: motorboot, kanoën, drakenboot of SUP. Helder water, vriendelijke mensen en een vlotte start.',
          calendarCta: 'Kalender',
          exploreCta: 'Activiteiten verkennen',
        },
        activities: {
          title: 'Kies jouw sport',
          subtitle: 'Alleen, in een team of in de club.',
          motorboatAlt: 'Motorboot icoon',
          motorboatTitle: 'Motorboot',
          motorboatText: 'Ligplaats, training en veilige uitstapjes voor motorbootleden.',
          motorboatMeta1: 'Tot 12 meter',
          motorboatMeta2: 'Training en veiligheid',
          motorboatCta: 'Bekijk motorboot',
          paddlingAlt: 'Kano icoon',
          paddlingTitle: 'Kanoën',
          paddlingText: 'Ontspannen tochten en groepsuitstapjes op het Havel-kanaal en de Havel.',
          paddlingMeta1: 'Enkel, dubbel, drievoudig',
          paddlingMeta2: 'Tochten voor elk niveau',
          paddlingCta: 'Bekijk kanoën',
          dragonAlt: 'Drakenboot icoon',
          dragonTitle: 'Drakenboot',
          dragonText: 'Teamtraining, wedstrijden en clubsleven voor ploegen met ritme.',
          dragonMeta1: '10–16 personen',
          dragonMeta2: 'Regelmatige evenementen',
          dragonCta: 'Bekijk drakenboot',
          supAlt: 'SUP icoon',
          supTitle: 'Stand-up paddleboarden',
          supText: 'Balans, techniek en tijd op het water voor beginners en gevorderden.',
          supMeta1: 'Solo of cursus',
          supMeta2: 'Boards aanwezig',
          supCta: 'Bekijk SUP',
        },
        about: {
          title: 'Waarom Havelkanal?',
          feature1: 'Helder, schoon water',
          feature2: 'Rustig water met weinig scheepvaart',
          feature3: 'Goede verbinding met de Havel en Berlijn',
          feature4: 'Constante waterdiepte en weinig stroming',
        },
        calendar: {
          title: 'Evenementenkalender',
          subtitle: 'Alle data in één oogopslag.',
          prevMonthAria: 'Vorige maand',
          nextMonthAria: 'Volgende maand',
          gridAriaLabel: 'Kalender',
          emptySelection: 'Kies een dag om evenementen te zien.',
          emptyDay: 'Geen evenementen op deze dag.',
          emptyUpcoming: 'Geen aankomende evenementen.',
          legend: 'Evenement beschikbaar',
          upcomingLabel: 'Volgende evenementen:',
          whenLabel: 'Datum',
          timeLabel: 'Tijd',
          locationLabel: 'Locatie',
          downloadIcs: 'Evenement downloaden (.ics)',
        },
      },
      login: {
        heading: 'Ledengebied',
        subtitle: 'Log in om verder te gaan.',
        username: 'Gebruikersnaam',
        password: 'Wachtwoord',
        submit: 'Inloggen',
        loading: 'Een moment...',
        forgot: 'Wachtwoord vergeten?',
        failed: 'Inloggen mislukt.',
        network: 'Netwerkfout. Probeer het opnieuw.',
      },
      forgot: {
        heading: 'Wachtwoord vergeten',
        subtitle: 'Voer je e-mailadres in. Als er een account bestaat, ontvang je een resetlink.',
        email: 'E-mailadres',
        submit: 'Resetlink verzenden',
        loading: 'Een moment...',
        back: 'Terug naar inloggen',
        sendError: 'Kan verzoek niet verzenden.',
        network: 'Netwerkfout. Probeer het opnieuw.',
      },
      reset: {
        heading: 'Nieuw wachtwoord',
        subtitle: 'Kies een nieuw wachtwoord van minimaal 8 tekens.',
        newPassword: 'Nieuw wachtwoord',
        confirmPassword: 'Wachtwoord bevestigen',
        submit: 'Wachtwoord opslaan',
        loading: 'Een moment...',
        success: 'Wachtwoord succesvol gewijzigd.',
        back: 'Naar inloggen',
        invalidLink: 'Ongeldige link. Vraag een nieuwe resetlink aan.',
        mismatch: 'Wachtwoorden komen niet overeen.',
        tooShort: 'Wachtwoord moet minimaal 8 tekens lang zijn.',
        saveError: 'Kan het wachtwoord niet opslaan.',
        network: 'Netwerkfout. Probeer het opnieuw.',
      },
      members: {
        heading: 'Ledengebied',
        welcomePlaceholder: 'Welkom!',
        welcome: 'Welkom, {username}!',
        listHeading: 'Ledenlijst',
        name: 'Naam',
        sport: 'Sport',
        since: 'Lid sinds',
        loading: 'Gegevens laden...',
        empty: 'Geen ledengegevens beschikbaar.',
      },
    },
  };

  var EVENT_TRANSLATIONS = {
    en: {
      'motorboot-sicherheitstraining.ics': {
        summary: 'Motorboat safety training',
        description: 'Mandatory training for all motorboat members covering emergencies, first aid on the water, navigation marks and regulations. Participation is recommended.',
        location: 'Havelkanal Watersports, Clubhouse, 14641 Nauen',
        categories: 'Motorboat',
      },
      'vereinsfest-2026.ics': {
        summary: 'Club festival 2026',
        description: 'Our annual club festival with barbecue by the water, demonstrations, awards and a relaxed get-together for members and guests.',
        location: 'Havelkanal Watersports, Club grounds, 14641 Nauen',
        categories: 'Club life',
      },
      'paddeln-tour-havel.ics': {
        summary: 'Paddling tour to the Havel',
        description: 'Guided paddling tour from the canal to the Havel and back. Around 15 km, suitable for experienced paddlers. Bring your own boat.',
        location: 'Havelkanal Watersports, Dock B, 14641 Nauen',
        categories: 'Paddling',
      },
      'sup-kurs-anfaenger.ics': {
        summary: 'Beginner SUP class',
        description: 'Stand-up paddleboarding for beginners. Boards and paddles are provided. Please bring swimwear and a towel. Maximum 8 participants.',
        location: 'Havelkanal Watersports, SUP area, 14641 Nauen',
        categories: 'SUP',
      },
      'drachenboot-wettkampf.ics': {
        summary: 'Dragon boat competition',
        description: 'Regional dragon boat competition on the Havel Canal. Teams of 10 to 16 people can register. Spectators are very welcome.',
        location: 'Havelkanal Watersports, Start area, 14641 Nauen',
        categories: 'Dragon boat',
      },
      'motorboot-training.ics': {
        summary: 'Motorboat training',
        description: 'Shared motorboat training session on the Havel Canal for beginners and experienced members alike. Please bring a life jacket.',
        location: 'Havelkanal Watersports, Dock A, 14641 Nauen',
        categories: 'Motorboat',
      },
    },
    pl: {
      'motorboot-sicherheitstraining.ics': {
        summary: 'Szkolenie z bezpieczeństwa motorówki',
        description: 'Obowiązkowe szkolenie dla wszystkich członków z motorówką obejmujące sytuacje awaryjne, pierwszą pomoc na wodzie, znaki nawigacyjne i przepisy. Udział jest zalecany.',
        location: 'Havelkanal Sporty Wodne, Świetlica, 14641 Nauen',
        categories: 'Motorówka',
      },
      'vereinsfest-2026.ics': {
        summary: 'Festyn klubowy 2026',
        description: 'Nasze coroczne święto klubowe z grillem nad wodą, pokazami, nagrodami i spokojnym spotkaniem dla członków i gości.',
        location: 'Havelkanal Sporty Wodne, Teren klubowy, 14641 Nauen',
        categories: 'Życie klubowe',
      },
      'paddeln-tour-havel.ics': {
        summary: 'Wycieczka kajakowa na Hawelę',
        description: 'Prowadzona wycieczka kajakowa z kanału na rzekę Hawelę i z powrotem. Około 15 km, odpowiednia dla doświadczonych kajakarzy. Przynieś własną łódź.',
        location: 'Havelkanal Sporty Wodne, Pomost B, 14641 Nauen',
        categories: 'Kajakarstwo',
      },
      'sup-kurs-anfaenger.ics': {
        summary: 'Kurs SUP dla początkujących',
        description: 'Stand-up paddleboarding dla początkujących. Deski i wiosła są zapewnione. Proszę zabrać strój kąpielowy i ręcznik. Maksymalnie 8 uczestników.',
        location: 'Havelkanal Sporty Wodne, Strefa SUP, 14641 Nauen',
        categories: 'SUP',
      },
      'drachenboot-wettkampf.ics': {
        summary: 'Zawody smoczych łodzi',
        description: 'Regionalne zawody smoczych łodzi na kanale Haweli. Mogą się rejestrować drużyny liczące od 10 do 16 osób. Kibice są bardzo mile widziani.',
        location: 'Havelkanal Sporty Wodne, Strefa startowa, 14641 Nauen',
        categories: 'Smocza łódź',
      },
      'motorboot-training.ics': {
        summary: 'Trening motorówki',
        description: 'Wspólna sesja treningowa motorówki na kanale Haweli dla początkujących i doświadczonych członków. Prosimy zabrać kamizelkę ratunkową.',
        location: 'Havelkanal Sporty Wodne, Pomost A, 14641 Nauen',
        categories: 'Motorówka',
      },
    },
    nl: {
      'motorboot-sicherheitstraining.ics': {
        summary: 'Veiligheidstraining motorboot',
        description: 'Verplichte training voor alle motorbootleden over noodsituaties, eerste hulp op het water, navigatiemerken en regelgeving. Deelname is aanbevolen.',
        location: 'Havelkanal Watersport, Clubhuis, 14641 Nauen',
        categories: 'Motorboot',
      },
      'vereinsfest-2026.ics': {
        summary: 'Clubfeest 2026',
        description: 'Ons jaarlijkse clubfeest met barbecue aan het water, demonstraties, prijsuitreikingen en een ontspannen bijeenkomst voor leden en gasten.',
        location: 'Havelkanal Watersport, Clubterrein, 14641 Nauen',
        categories: 'Clubleven',
      },
      'paddeln-tour-havel.ics': {
        summary: 'Kanotocht naar de Havel',
        description: 'Begeleide kanotocht van het kanaal naar de Havel en terug. Ongeveer 15 km, geschikt voor ervaren kanoërs. Breng je eigen boot mee.',
        location: 'Havelkanal Watersport, Steiger B, 14641 Nauen',
        categories: 'Kanoën',
      },
      'sup-kurs-anfaenger.ics': {
        summary: 'SUP-cursus voor beginners',
        description: 'Stand-up paddleboarden voor beginners. Boards en peddels worden verstrekt. Breng alsjeblieft zwemkleding en een handdoek mee. Maximaal 8 deelnemers.',
        location: 'Havelkanal Watersport, SUP-zone, 14641 Nauen',
        categories: 'SUP',
      },
      'drachenboot-wettkampf.ics': {
        summary: 'Drakenbootwedstrijd',
        description: 'Regionale drakenbootwedstrijd op het Havel-kanaal. Teams van 10 tot 16 mensen kunnen zich inschrijven. Toeschouwers zijn van harte welkom.',
        location: 'Havelkanal Watersport, Startzone, 14641 Nauen',
        categories: 'Drakenboot',
      },
      'motorboot-training.ics': {
        summary: 'Motorboottraining',
        description: 'Gezamenlijke motorboottrainingssessie op het Havel-kanaal voor zowel beginners als ervaren leden. Breng alsjeblieft een reddingsvest mee.',
        location: 'Havelkanal Watersport, Steiger A, 14641 Nauen',
        categories: 'Motorboot',
      },
    },
  };

  var SPORT_TRANSLATIONS = {
    en: {
      'Paddeln': 'Paddling',
      'Drachenboot': 'Dragon boat',
      'Stand-up Paddeln': 'Stand-up paddleboarding',
      'Motorboot': 'Motorboat',
    },
    pl: {
      'Paddeln': 'Kajakarstwo',
      'Drachenboot': 'Smocza łódź',
      'Stand-up Paddeln': 'Stand-up paddleboarding',
      'Motorboot': 'Motorówka',
    },
    nl: {
      'Paddeln': 'Kanoën',
      'Drachenboot': 'Drakenboot',
      'Stand-up Paddeln': 'Stand-up paddleboarden',
      'Motorboot': 'Motorboot',
    },
  };

  var currentLanguage = DEFAULT_LANGUAGE;

  function normalizeLanguage(value) {
    if (!value) return null;

    var language = String(value).trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGUAGES.indexOf(language) >= 0 ? language : null;
  }

  function getCookieLanguage() {
    var match = document.cookie.match(/(?:^|; )locale=([^;]+)/);
    return match ? normalizeLanguage(decodeURIComponent(match[1])) : null;
  }

  function getQueryLanguage() {
    try {
      return normalizeLanguage(new URLSearchParams(window.location.search).get('lang'));
    } catch (_) {
      return null;
    }
  }

  function getPreferredLanguage() {
    var queryLanguage = getQueryLanguage();
    if (queryLanguage) return queryLanguage;

    try {
      var stored = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch (_) {
      /* localStorage can be disabled */
    }

    return getCookieLanguage() || normalizeLanguage(navigator.language) || DEFAULT_LANGUAGE;
  }

  function getValue(obj, path) {
    if (!obj || !path) return undefined;

    var parts = path.split('.');
    var value = obj;
    for (var i = 0; i < parts.length; i++) {
      if (!value || !Object.prototype.hasOwnProperty.call(value, parts[i])) return undefined;
      value = value[parts[i]];
    }
    return value;
  }

  function interpolate(value, vars) {
    return String(value).replace(/\{(\w+)\}/g, function (_, key) {
      return vars && vars[key] != null ? String(vars[key]) : '';
    });
  }

  function t(path, vars, language) {
    var lang = normalizeLanguage(language) || currentLanguage;
    var value = getValue(TRANSLATIONS[lang], path);

    if (value == null) value = getValue(TRANSLATIONS[DEFAULT_LANGUAGE], path);
    if (value == null) return path;

    return typeof value === 'string' ? interpolate(value, vars) : value;
  }

  function applyAttributeTranslations(root, attrName, targetAttr) {
    var nodes = root.querySelectorAll('[' + attrName + ']');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      node.setAttribute(targetAttr, t(node.getAttribute(attrName)));
    }
  }

  function applyPageTranslations(root) {
    var scope = root || document;
    var textNodes = scope.querySelectorAll('[data-i18n]');
    var htmlNodes = scope.querySelectorAll('[data-i18n-html]');

    for (var i = 0; i < textNodes.length; i++) {
      textNodes[i].textContent = t(textNodes[i].getAttribute('data-i18n'));
    }

    for (var j = 0; j < htmlNodes.length; j++) {
      htmlNodes[j].innerHTML = t(htmlNodes[j].getAttribute('data-i18n-html'));
    }

    applyAttributeTranslations(scope, 'data-i18n-placeholder', 'placeholder');
    applyAttributeTranslations(scope, 'data-i18n-aria-label', 'aria-label');
    applyAttributeTranslations(scope, 'data-i18n-alt', 'alt');
    applyAttributeTranslations(scope, 'data-i18n-title', 'title');
    applyAttributeTranslations(scope, 'data-i18n-content', 'content');

    document.documentElement.lang = currentLanguage;
    syncLanguageLinks();
  }

  function withLanguage(url, language) {
    var nextLanguage = normalizeLanguage(language) || currentLanguage;
    if (!url) return url;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(url)) return url;

    try {
      var resolved = new URL(url, window.location.href);
      if (resolved.origin !== window.location.origin) return url;

      resolved.searchParams.set('lang', nextLanguage);

      if (resolved.pathname === window.location.pathname && !resolved.hash && url.charAt(0) === '#') {
        resolved.hash = url;
      }

      return resolved.pathname + resolved.search + resolved.hash;
    } catch (_) {
      return url;
    }
  }

  function syncLanguageLinks() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var originalHref = link.dataset.i18nHref || link.getAttribute('href');
      if (!originalHref) continue;

      link.dataset.i18nHref = originalHref;
      link.setAttribute('href', withLanguage(originalHref));
    }
  }

  function syncCurrentUrl() {
    if (!window.history || typeof window.history.replaceState !== 'function') return;

    var nextUrl = withLanguage(window.location.href);
    if (nextUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }

  function syncLanguageSwitchers() {
    var switchers = document.querySelectorAll('[data-language-switcher]');
    for (var i = 0; i < switchers.length; i++) {
      switchers[i].value = currentLanguage;
    }
  }

  function persistLanguage(language) {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch (_) {
      /* localStorage can be disabled */
    }

    document.cookie = COOKIE_KEY + '=' + encodeURIComponent(language) + '; Path=/; Max-Age=31536000; SameSite=Lax';
  }

  function setLanguage(language) {
    var nextLanguage = normalizeLanguage(language) || DEFAULT_LANGUAGE;
    currentLanguage = nextLanguage;

    persistLanguage(nextLanguage);
    syncCurrentUrl();
    syncLanguageSwitchers();
    applyPageTranslations(document);

    document.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, {
      detail: { language: nextLanguage },
    }));

    return nextLanguage;
  }

  function bindLanguageSwitchers() {
    var switchers = document.querySelectorAll('[data-language-switcher]');
    for (var i = 0; i < switchers.length; i++) {
      if (switchers[i].dataset.boundLanguageSwitcher === 'true') continue;
      switchers[i].dataset.boundLanguageSwitcher = 'true';
      switchers[i].addEventListener('change', function (event) {
        setLanguage(event.target.value);
      });
    }
  }

  function localizeEvent(event) {
    var overrides = EVENT_TRANSLATIONS[currentLanguage] && EVENT_TRANSLATIONS[currentLanguage][event.file];
    if (!overrides) return event;

    return Object.assign({}, event, overrides);
  }

  function localizeSport(sport) {
    return SPORT_TRANSLATIONS[currentLanguage] && SPORT_TRANSLATIONS[currentLanguage][sport] || sport;
  }

  function init() {
    currentLanguage = getPreferredLanguage();
    persistLanguage(currentLanguage);
    bindLanguageSwitchers();
    syncLanguageSwitchers();
    applyPageTranslations(document);
  }

  window.WassersportI18n = {
    eventName: LANGUAGE_EVENT,
    getLanguage: function () { return currentLanguage; },
    localizeEvent: localizeEvent,
    localizeSport: localizeSport,
    normalizeLanguage: normalizeLanguage,
    setLanguage: setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES.slice(),
    t: t,
    withLanguage: withLanguage,
  };

  init();
})();
