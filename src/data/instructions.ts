import type { InstructionGuide } from "../types/instruction";

export const instructions: InstructionGuide[] = [
  {
    id: "klima-001",
    slug: "klima-sporadisch-keine-kühlung",
    title: "Klimaanlage kühlt sporadisch nicht",
    subtitle:
      "Diagnoseablauf für Fahrzeuge, bei denen die Klimaanlage zeitweise ausfällt, aber kein eindeutiger Fehler gespeichert ist.",
    category: "Klima",
    difficulty: "mittel",
    estimatedTime: "30–60 Minuten",
    vehicleApplicability: "Universell für viele moderne Fahrzeuge mit geregeltem Klimakompressor",
    tags: ["Klima", "Klimakompressor", "Kaeltemittel", "Drucksensor", "Mischklappe"],
    symptoms: [
      "Klimaanlage kühlt manchmal nicht",
      "Keine oder schwache Kaltluft",
      "Fehlerspeicher leer",
      "Kompressor wird nicht immer angesteuert",
      "Kühlleistung kommt verzoegert"
    ],
    tools: [
      "Diagnosetester",
      "Klimaservicegerät",
      "Thermometer",
      "Multimeter",
      "Stromlaufplan bei Bedarf"
    ],
    safetyNotes: [
      "Arbeiten am Kaeltemittelkreislauf nur mit geeignetem Klimaservicegerät durchführen.",
      "Kaeltemittel nicht in die Umwelt ablassen.",
      "Druckwerte immer mit Herstellerangaben vergleichen."
    ],
    initialChecks: [
      "Kaeltemittelmenge prüfen.",
      "Fehlerspeicher von Klimabedienteil, Motorsteuergerät und Bordnetz prüfen.",
      "Außentemperaturwert im Istwertblock prüfen.",
      "Innenraumtemperatursensor und Sonnensensor prüfen.",
      "Kühlerlüfter-Ansteuerung prüfen."
    ],
    steps: [
      {
        title: "Kundenbeanstandung nachvollziehen",
        description:
          "Motor starten, Klimaanlage auf LOW stellen, Geblaese mittlere Stufe, Umluft aus. Beobachten, ob die Luft an den Duesen innerhalb weniger Minuten deutlich abkühlt.",
        check: "Ausblastemperatur an mittlerer Duese messen."
      },
      {
        title: "Kaeltemittelmenge bewerten",
        description:
          "Mit Klimaservicegerät absaugen und die Ist-Menge mit der Soll-Fuellmenge vergleichen. Eine geringe Abweichung muss nicht zwingend der Fehler sein, kann aber bei Grenzfällen relevant werden.",
        warning:
          "Nicht blind nachfuellen. Erst absaugen, Menge prüfen, Anlage evakuieren und korrekt befuellen."
      },
      {
        title: "Druckwerte prüfen",
        description:
          "Hochdruck- und Niederdruckseite bei laufender Klimaanlage beobachten. Der Hochdruck muss bei aktiver Kühlung plausibel ansteigen.",
        check:
          "Wenn der Hochdruck nicht ansteigt, wird der Kompressor nicht gefoerdert oder nicht korrekt angesteuert."
      },
      {
        title: "Kompressorfreigabe prüfen",
        description:
          "Im Diagnosetester prüfen, ob das Klimasteuergerät den Kompressor freigibt. Sperrbedingungen wie Außentemperatur, Motortemperatur, Drucksensorwert oder Lastabschaltung beachten."
      },
      {
        title: "Drucksensor plausibilisieren",
        description:
          "Drucksensorwert bei stehendem Motor mit Umgebungstemperatur vergleichen. Unplausible Werte können dazu führen, dass die Klimaanlage gesperrt wird."
      },
      {
        title: "Kühlerlüfter prüfen",
        description:
          "Bei aktiver Klimaanlage muss der Kühlerlüfter je nach Fahrzeug zumindest zeitweise laufen. Ohne Lüfter steigt der Hochdruck stark an, danach wird die Klima abgeschaltet.",
        warning:
          "Bei zu hohem Hochdruck nicht weiterlaufen lassen. Gefahr von Anlagenschäden."
      },
      {
        title: "Mischklappen prüfen",
        description:
          "Wenn der Kaeltekreislauf korrekt arbeitet, aber warme Luft aus den Duesen kommt, Stellmotoren und Temperaturklappen prüfen."
      }
    ],
    commonCauses: [
      "Zu geringe oder falsche Kaeltemittelmenge",
      "Defekter Drucksensor",
      "Kühlerlüfter läuft nicht",
      "Kompressorregelventil defekt",
      "Mischklappe hängt",
      "Außentemperaturwert unplausibel"
    ],
    nextActions: [
      "Bei unplausiblen Druckwerten Drucksensor und Verkabelung prüfen.",
      "Bei fehlender Kompressorfreigabe Sperrbedingung im Steuergerät suchen.",
      "Bei korrektem Kaeltekreislauf Luftverteilung und Mischklappen prüfen."
    ],
    proHint:
      "Bei sporadischen Ausfällen Istwerte während der Probefahrt aufzeichnen: Kompressorfreigabe, Hochdruck, Außentemperatur, Verdampfertemperatur und Lüfteransteuerung.",
    lastUpdated: "2026-06-29"
  },
  {
    id: "motor-001",
    slug: "turbolader-wiederholt-defekt-oelversorgung-prüfen",
    title: "Turbolader wiederholt defekt – Oelversorgung prüfen",
    subtitle:
      "Diagnoseablauf bei erneutem Turboladerschaden kurz nach dem Austausch.",
    category: "Motor",
    difficulty: "schwer",
    estimatedTime: "60–120 Minuten",
    vehicleApplicability:
      "Universell für Turbomotoren, besonders relevant bei kleinen Benzin-Turbomotoren und bekannten Oelversorgungsproblemen",
    tags: ["Turbolader", "Oelversorgung", "Oelsieb", "Oelrücklauf", "Ladedruck"],
    symptoms: [
      "Turbolader nach kurzer Laufleistung erneut defekt",
      "Pfeifgeraeusche",
      "Oel im Ansaugtrakt",
      "Ladedruckfehler",
      "Starker Oelverbrauch",
      "Rauchentwicklung"
    ],
    tools: [
      "Diagnosetester",
      "Oeldruckprüfer",
      "Endoskop",
      "Multimeter",
      "Unterdruck-/Druckpumpe",
      "Herstellerunterlagen"
    ],
    safetyNotes: [
      "Nach Turboschaden Ansaug- und Ladeluftstrecke immer auf Oel und Fremdkoerper prüfen.",
      "Motor nicht weiterlaufen lassen, wenn der Verdacht auf Mangelschmierung besteht.",
      "Drehmomente, Oelqualität und Einbauvorschriften immer nach Herstellerangabe verwenden."
    ],
    initialChecks: [
      "Oelstand und Oelqualität prüfen.",
      "Oelfilter und Oelwechselhistorie prüfen.",
      "Oelzulaufleitung auf Verkokung oder Verengung prüfen.",
      "Oelrücklaufleitung auf Knick, Verstopfung oder falsche Montage prüfen.",
      "Kurbelgehaeuseentlueftung prüfen."
    ],
    steps: [
      {
        title: "Schadensbild am alten Turbolader prüfen",
        description:
          "Verdichterrad, Turbinenrad und Welle prüfen. Spuren von Oelmangel, Fremdkoerpern oder Ueberdrehzahl unterscheiden.",
        check:
          "Blau angelaufene Welle oder eingelaufene Lager deuten häufig auf Oelproblem hin."
      },
      {
        title: "Oelzulaufleitung ausbauen und prüfen",
        description:
          "Leitung nicht nur optisch außen prüfen. Innen auf Verkokung, zugesetzte Hohlschrauben, Siebe oder Rückstaende prüfen.",
        warning:
          "Bei wiederholtem Turboschaden Oelzulaufleitung im Zweifel ersetzen."
      },
      {
        title: "Oelrücklauf prüfen",
        description:
          "Der Rücklauf muss frei, spannungsfrei und ohne Knick montiert sein. Rückstau führt zu Oelverlust am Turbolader."
      },
      {
        title: "Oeldruck prüfen",
        description:
          "Oeldruck kalt und warm messen. Werte mit Herstellervorgabe vergleichen. Auch zugesetzte Oelkanaele oder verschlissene Oelpumpe berücksichtigen."
      },
      {
        title: "Ansaug- und Ladeluftstrecke reinigen",
        description:
          "Ladeluftkühler, Schlaeuche und Ansaugwege auf Oel, Metallspaene und Fremdkoerper prüfen. Rückstaende können den neuen Lader sofort beschaedigen."
      },
      {
        title: "Kurbelgehaeuseentlueftung prüfen",
        description:
          "Eine defekte Entlueftung kann Ueberdruck im Kurbelgehaeuse erzeugen. Dadurch wird der Oelrücklauf aus dem Turbolader gestoert."
      },
      {
        title: "Erstinbetriebnahme korrekt durchführen",
        description:
          "Turbolader vor dem Start mit geeignetem Oel vorbefuellen. Motor zunächst ohne Last laufen lassen und Dichtigkeit prüfen."
      }
    ],
    commonCauses: [
      "Verkokte Oelzulaufleitung",
      "Zugesetztes Sieb in Hohlschraube oder Leitung",
      "Oelrücklauf blockiert",
      "Falsches oder altes Motoroel",
      "Metallreste vom ersten Turboschaden",
      "Defekte Kurbelgehaeuseentlueftung",
      "Ladedruckregelung verursacht Ueberdrehzahl"
    ],
    nextActions: [
      "Oelzulaufleitung ersetzen, wenn Verkokung sichtbar oder vermutet wird.",
      "Ladeluftkühler reinigen oder ersetzen, wenn Metallspaene vorhanden sind.",
      "Oeldruck dokumentieren.",
      "Nach Reparatur Probefahrt mit Ladedruck-Ist/Soll-Werten durchführen."
    ],
    proHint:
      "Bei wiederholtem Turboschaden nie nur den Lader ersetzen. Die Ursache liegt sehr häufig im Umfeld: Oelversorgung, Rücklauf, Entlueftung, Fremdkoerper oder Regelung.",
    lastUpdated: "2026-06-29"
  },
  {
    id: "fahrwerk-001",
    slug: "passat-b8-vorderachse-aggregateträger-zentrieren",
    title: "Passat B8 Vorderachse / Aggregateträger zentrieren",
    subtitle:
      "Ablauf zum Ausrichten des Aggregateträgers nach Achsarbeiten oder Unfallschaden.",
    category: "Fahrwerk",
    difficulty: "schwer",
    estimatedTime: "60–90 Minuten",
    vehicleApplicability:
      "VW Passat B8 und aehnliche MQB-Fahrzeuge mit Zentrier-/Absteckpunkten",
    tags: ["Passat B8", "Achse", "Aggregateträger", "Spur", "Sturz", "Unfallschaden"],
    symptoms: [
      "Lenkrad steht schief",
      "Fahrzeug zieht zur Seite",
      "Sturz links/rechts stark unterschiedlich",
      "Achse wurde geloest oder ersetzt",
      "Nach Unfallschaden keine saubere Achsgeometrie"
    ],
    tools: [
      "Absteck-/Zentrierstifte",
      "Hebebuehne",
      "Achsvermessungsgerät",
      "Drehmomentschluessel",
      "Herstellerunterlagen"
    ],
    safetyNotes: [
      "Schrauben des Aggregateträgers sind je nach Fahrzeug Dehnschrauben und müssen ersetzt werden.",
      "Drehmomente und Anzugswinkel immer nach Herstellervorgabe verwenden.",
      "Nach Arbeiten am Aggregateträger ist eine Achsvermessung erforderlich."
    ],
    initialChecks: [
      "Reifenluftdruck prüfen.",
      "Felgen/Reifen auf Beschaedigung prüfen.",
      "Querlenker, Radlagergehaeuse und Hilfsrahmen auf Unfallschäden prüfen.",
      "Lenkgetriebe und Spurstangen auf Verzug prüfen.",
      "Karosserie-Aufnahmepunkte prüfen."
    ],
    steps: [
      {
        title: "Fahrzeug vorbereiten",
        description:
          "Fahrzeug auf die Buehne nehmen. Unterbodenverkleidung entfernen. Sichtprüfung der Achsteile durchführen."
      },
      {
        title: "Aggregateträger-Schrauben loesen",
        description:
          "Befestigungsschrauben des Aggregateträgers nur so weit loesen, dass sich der Träger ausrichten laesst. Nicht vollständig entfernen, sofern nicht erforderlich.",
        warning:
          "Motor/Getriebe je nach Fahrzeugzustand abstuetzen, wenn tragende Komponenten geloest werden."
      },
      {
        title: "Zentrierstifte einsetzen",
        description:
          "Die passenden Absteckstifte in die vorgesehenen Zentrierbohrungen einsetzen. Der Aggregateträger muss spannungsfrei in Position gebracht werden."
      },
      {
        title: "Aggregateträger ausrichten",
        description:
          "Aggregateträger vorsichtig verschieben, bis die Zentrierstifte sauber sitzen. Nicht mit Gewalt verspannen."
      },
      {
        title: "Schrauben nach Herstellervorgabe anziehen",
        description:
          "Neue Schrauben verwenden, falls vorgeschrieben. In der korrekten Reihenfolge mit Drehmoment und Winkel anziehen."
      },
      {
        title: "Achsvermessung durchführen",
        description:
          "Spur, Sturz und Nachlauf prüfen. Bei MQB-Fahrzeugen kann der Sturz ueber die Aggregateträgerlage beeinflusst werden."
      },
      {
        title: "Probefahrt und Lenkwinkel prüfen",
        description:
          "Nach Vermessung Probefahrt durchführen. Lenkradstellung, Geradeauslauf und Lenkwinkelsensor prüfen."
      }
    ],
    commonCauses: [
      "Aggregateträger nach Reparatur versetzt montiert",
      "Querlenker oder Radlagergehaeuse verzogen",
      "Falsche oder beschädigte Achsteile verbaut",
      "Karosserieaufnahme nach Unfall verschoben",
      "Keine Achsvermessung nach Montage"
    ],
    nextActions: [
      "Wenn Werte trotz Zentrierung nicht passen, Karosseriemaße prüfen.",
      "Bei stark abweichendem Sturz Radlagergehaeuse und Querlenker vergleichen.",
      "Lenkwinkelsensor nach Vermessung kalibrieren, falls erforderlich."
    ],
    proHint:
      "Bei Unfallschäden erst mechanisch messen, dann vermessen. Eine Achsvermessung kaschiert keinen verzogenen Hilfsrahmen oder Radträger.",
    lastUpdated: "2026-06-29"
  },
  {
    id: "elektrik-001",
    slug: "nissan-qashqai-geblaesemotor-widerstand-prüfen",
    title: "Nissan Qashqai Geblaesemotor / Innenraumwiderstand prüfen",
    subtitle:
      "Diagnoseablauf bei ausgefallenem Innenraumgeblaese oder defektem Geblaeseregler.",
    category: "Elektrik",
    difficulty: "mittel",
    estimatedTime: "30–75 Minuten",
    vehicleApplicability:
      "Nissan Qashqai und aehnliche Fahrzeuge mit Geblaesemotor und Vorwiderstand/Geblaeseregler",
    tags: ["Nissan", "Qashqai", "Geblaese", "Innenraumwiderstand", "Geblaeseregler"],
    symptoms: [
      "Geblaese läuft nicht",
      "Geblaese läuft nur auf höchster Stufe",
      "Geblaese läuft sporadisch",
      "Innenraumlueftung fällt aus",
      "Stecker am Widerstand verschmort"
    ],
    tools: [
      "Diagnosetester",
      "Multimeter",
      "Prüflampe",
      "Torx-/Kunststoffwerkzeug",
      "Stromlaufplan bei Bedarf"
    ],
    safetyNotes: [
      "Vor Arbeiten an elektrischen Steckern Zuendung ausschalten.",
      "Verschmorte Stecker nicht nur reinigen, sondern fachgerecht ersetzen.",
      "Keine Brücken setzen, ohne Stromlaufplan und Absicherung zu prüfen."
    ],
    initialChecks: [
      "Sicherungen prüfen.",
      "Geblaese auf allen Stufen testen.",
      "Bedienteilfunktion prüfen.",
      "Stecker am Geblaesemotor und Widerstand auf Hitze-/Schmorspuren prüfen.",
      "Wassereintritt im Fußraum prüfen."
    ],
    steps: [
      {
        title: "Fehlerbild eingrenzen",
        description:
          "Prüfen, ob das Geblaese komplett tot ist oder nur einzelne Stufen fehlen. Das Fehlerbild entscheidet, ob eher Motor, Widerstand oder Ansteuerung betroffen ist."
      },
      {
        title: "Sicherungen und Versorgung prüfen",
        description:
          "Sicherung für Innenraumgeblaese prüfen. Danach Spannung am Geblaesemotor bei eingeschalteter Lueftung messen."
      },
      {
        title: "Geblaesemotor direkt bewerten",
        description:
          "Wenn Spannung und Masse vorhanden sind, aber der Motor nicht läuft, ist der Geblaesemotor wahrscheinlich defekt oder schwergaengig."
      },
      {
        title: "Geblaesewiderstand / Regler prüfen",
        description:
          "Wenn einzelne Stufen fehlen oder das Geblaese nur auf höchster Stufe läuft, Regler/Widerstand und Stecker prüfen."
      },
      {
        title: "Stecker auf Uebergangswiderstand prüfen",
        description:
          "Verschmorte Kontakte verursachen Spannungsabfall und Folgeschäden am neuen Regler."
      },
      {
        title: "Geblaesekasten auf Blockade prüfen",
        description:
          "Laub, Wasser oder ein schwergaengiger Lüftermotor kann den Strom erhoehen und den Widerstand erneut zerstören."
      }
    ],
    commonCauses: [
      "Defekter Geblaesewiderstand",
      "Schwergaengiger Geblaesemotor",
      "Verschmorter Stecker",
      "Defekte Sicherung",
      "Wassereintritt",
      "Bedienteil oder Ansteuerung fehlerhaft"
    ],
    nextActions: [
      "Bei defektem Widerstand auch Geblaesemotor auf Stromaufnahme prüfen.",
      "Verschmorte Stecker ersetzen.",
      "Innenraumfilter und Wasserkasten prüfen."
    ],
    proHint:
      "Wenn nur der Widerstand ersetzt wird, aber der Geblaesemotor schwergaengig ist, kommt der Fehler oft wieder.",
    lastUpdated: "2026-06-29"
  },
  {
    id: "diagnose-001",
    slug: "tdi-dpf-differenzdruck-regeneration-prüfen",
    title: "TDI DPF / Differenzdruck / Regeneration prüfen",
    subtitle:
      "Grunddiagnose bei Dieselpartikelfilter-Problemen, erhöhtem Differenzdruck oder Regenerationsproblemen.",
    category: "Diagnose",
    difficulty: "mittel",
    estimatedTime: "45–90 Minuten",
    vehicleApplicability:
      "Viele moderne Diesel-Fahrzeuge mit DPF und Differenzdrucksensor",
    tags: ["TDI", "DPF", "Differenzdruck", "Regeneration", "Diesel"],
    symptoms: [
      "DPF-Warnlampe",
      "Notlauf",
      "Erhöhter Verbrauch",
      "Lüfter läuft nach",
      "Regeneration bricht ab",
      "Differenzdruckfehler"
    ],
    tools: [
      "Diagnosetester",
      "Differenzdruck-Schlauchprüfung",
      "Abgastemperatur-Istwerte",
      "Herstellerunterlagen"
    ],
    safetyNotes: [
      "Regeneration nur durchführen, wenn Oelstand und Motorzustand unkritisch sind.",
      "Brandgefahr durch hohe Abgastemperaturen beachten.",
      "Bei stark beladenem DPF keine Zwangsregeneration ohne Herstellerfreigabe durchführen."
    ],
    initialChecks: [
      "Fehlerspeicher Motorsteuergerät auslesen.",
      "Aschemasse und Rußmasse prüfen.",
      "Differenzdruck im Leerlauf und bei erhöhter Drehzahl prüfen.",
      "Abgastemperatursensoren plausibilisieren.",
      "AGR- und Ladedruckfehler berücksichtigen."
    ],
    steps: [
      {
        title: "Fehlerspeicher vollständig auslesen",
        description:
          "Nicht nur DPF-Fehler betrachten. Ladedruck, AGR, Temperatursensoren und Gluehkerzen können Regenerationen verhindern."
      },
      {
        title: "Differenzdruck im Leerlauf prüfen",
        description:
          "Differenzdruckwert bei warmem Motor im Leerlauf prüfen. Sehr hohe Werte deuten auf Beladung, verstopfte Leitungen oder Sensorfehler hin."
      },
      {
        title: "Differenzdruck bei erhöhter Drehzahl prüfen",
        description:
          "Wert bei ca. 2500 U/min beobachten. Der Wert muss plausibel steigen, darf aber nicht extrem hoch sein."
      },
      {
        title: "Schlaeuche zum Differenzdrucksensor prüfen",
        description:
          "Schlaeuche auf Risse, Verstopfung, Kondensat oder falschen Anschluss prüfen."
      },
      {
        title: "Ruß- und Aschemasse bewerten",
        description:
          "Ruß kann regeneriert werden. Asche nicht. Hohe Aschemasse deutet auf das Lebensdauerende des DPF hin."
      },
      {
        title: "Regenerationsbedingungen prüfen",
        description:
          "Kühlmitteltemperatur, Kraftstoffstand, Fehlerspeicher, Temperatursensoren und Fahrprofil prüfen."
      }
    ],
    commonCauses: [
      "DPF stark mit Ruß beladen",
      "DPF mit Asche voll",
      "Differenzdrucksensor defekt",
      "Schlaeuche verstopft oder vertauscht",
      "Abgastemperatursensor unplausibel",
      "AGR- oder Ladedruckproblem verhindert Regeneration"
    ],
    nextActions: [
      "Bei Sensorverdacht Differenzdrucksensor und Leitungen prüfen.",
      "Bei hoher Rußmasse Ursache der fehlenden Regeneration beheben.",
      "Bei hoher Aschemasse DPF-Reinigung oder Ersatz prüfen."
    ],
    proHint:
      "Ein voller DPF ist oft Folgefehler. Vor Reinigung oder Austausch immer prüfen, warum die Regeneration nicht sauber funktioniert.",
    lastUpdated: "2026-06-29"
  }
];

export function getInstructionBySlug(slug: string): InstructionGuide | undefined {
  return instructions.find((instruction) => instruction.slug === slug);
}