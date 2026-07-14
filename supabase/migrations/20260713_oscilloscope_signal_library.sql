create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.oscilloscope_signal_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default '',
  category text not null default 'Drucksensor',
  system_group text not null default '',
  signal_type text not null default '',
  summary text not null default '',
  when_to_use text[] not null default '{}'::text[],
  measurement_setup text[] not null default '{}'::text[],
  expected_pattern text not null default '',
  reference_values jsonb not null default '[]'::jsonb,
  common_faults jsonb not null default '[]'::jsonb,
  safety_notes text[] not null default '{}'::text[],
  next_checks text[] not null default '{}'::text[],
  channels jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  source_note text not null default '',
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oscilloscope_signal_library_category_check check (
    category in (
      'Kurbel-/Nockenwellensensor',
      'LIN/CAN',
      'Einspritzung',
      'Zündung',
      'Lambdasonde',
      'Drucksensor',
      'Stromaufnahme'
    )
  ),
  constraint oscilloscope_signal_library_status_check check (
    status in ('approved', 'needs_review', 'archived')
  )
);

create index if not exists oscilloscope_signal_library_category_idx
  on public.oscilloscope_signal_library(category, updated_at desc);

create index if not exists oscilloscope_signal_library_tags_idx
  on public.oscilloscope_signal_library using gin(tags);

drop trigger if exists set_oscilloscope_signal_library_updated_at
  on public.oscilloscope_signal_library;

create trigger set_oscilloscope_signal_library_updated_at
before update on public.oscilloscope_signal_library
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.oscilloscope_signal_library enable row level security;

drop policy if exists "Freigegebene Signalbibliothek lesen"
  on public.oscilloscope_signal_library;

create policy "Freigegebene Signalbibliothek lesen"
on public.oscilloscope_signal_library
for select
to authenticated
using (status = 'approved');

insert into public.oscilloscope_signal_library (
  slug,
  title,
  category,
  system_group,
  signal_type,
  summary,
  when_to_use,
  measurement_setup,
  expected_pattern,
  reference_values,
  common_faults,
  safety_notes,
  next_checks,
  channels,
  tags,
  source_note,
  status
)
values
(
  'kurbelwellensensor-induktiv',
  'Kurbelwellensensor induktiv',
  'Kurbel-/Nockenwellensensor',
  'Motordrehzahl / Synchronisation',
  'analoger Wechselspannungssensor',
  'Induktiver Kurbelwellensensor mit sinusähnlichem Signal. Amplitude steigt mit Drehzahl; Zahnlücke dient häufig als Referenz.',
  array[
    'Motor startet nicht, Drehzahlsignal fehlt oder springt.',
    'Fehler zu Kurbelwellensensor, Synchronisation oder Aussetzern.',
    'Verdacht auf falschen Sensorabstand, Kabelbruch oder beschädigtes Geberrad.'
  ],
  array[
    'Zweikanal oder Einkanal am Sensorsignal messen, möglichst ohne Leitung zu beschädigen.',
    'AC-Kopplung oder passende Spannungsauflösung wählen, beim Starten und im Leerlauf vergleichen.',
    'Massebezug und Schirmung prüfen, wenn das Signal stark verrauscht ist.'
  ],
  'Gleichmäßige Sinusfolge mit klarer Zahnlücke. Beim Starten kleinere Amplitude, bei höherer Drehzahl deutlich größere Amplitude.',
  '[
    {"label":"Amplitude beim Starten","value":"oft grob ab ca. 0,5 V AC erkennbar","condition":"sensor- und drehzahlabhängig","confidence":"systemabhängig","note":"Kein Hersteller-Sollwert. Entscheidend sind saubere Form, Wiederholbarkeit und Steuergeräteerkennung."},
    {"label":"Widerstand","value":"nur nach Herstellerdaten bewerten","condition":"Sensor abgesteckt","confidence":"nur Vergleich","note":"Widerstand allein beweist den Sensor nicht sicher."}
  ]'::jsonb,
  '[
    {"title":"Kein Signal beim Starten","symptom":"Drehzahl im Tester bleibt 0, Motor startet nicht.","signalClue":"Linie bleibt flach oder nur Störungen sichtbar.","nextCheck":"Sensorversorgung je nach Bauart, Sensorabstand, Geberrad und Leitung prüfen.","severity":"warning"},
    {"title":"Unregelmäßige Zahnlücke","symptom":"Startprobleme, Aussetzer oder Synchronisationsfehler.","signalClue":"Abstände oder Amplituden brechen an gleicher Stelle ein.","nextCheck":"Geberrad auf Schlag, Beschädigung, Verschmutzung und korrekten Sitz prüfen.","severity":"warning"}
  ]'::jsonb,
  array[
    'Beim Starten auf rotierende Teile, Lüfter und Riemen achten.',
    'Keine Leitungen durchstechen, wenn ein Adapter oder Backprobing möglich ist.'
  ],
  array[
    'Drehzahlanzeige im Diagnosetester mit Oszilloskopbild vergleichen.',
    'Kurbel- und Nockenwellensignal gemeinsam messen, wenn Synchronisation verdächtig ist.',
    'Sensorabstand und Geberrad mechanisch prüfen, bevor Teile getauscht werden.'
  ],
  '[
    {"label":"KW-Signal","color":"#2563eb","unit":"V AC","scaleHint":"Amplitude drehzahlabhängig","points":[0.5,0.68,0.83,0.92,0.86,0.7,0.5,0.3,0.14,0.08,0.17,0.32,0.5,0.68,0.83,0.92,0.86,0.7,0.5,0.3,0.14,0.08,0.17,0.32,0.5,0.5,0.5,0.68,0.83,0.92,0.86,0.7,0.5]}
  ]'::jsonb,
  array['kurbelwellensensor','kw-sensor','drehzahl','induktiv','startet nicht'],
  'Allgemeines Referenzsignal. Exakte Pegel, Widerstände und Pinbelegung immer mit Herstellerdaten prüfen.',
  'approved'
),
(
  'kurbel-nockenwellensensor-hall',
  'Hallgeber Kurbelwelle / Nockenwelle',
  'Kurbel-/Nockenwellensensor',
  'Motorsynchronisation',
  'digitales Rechtecksignal',
  'Hallgeber liefern ein digitales Signal mit klaren Flanken. Je nach System liegt der Pegel bei etwa 0 bis 5 V oder 0 bis Batteriespannung.',
  array[
    'Plausibilitätsfehler Kurbelwelle/Nockenwelle.',
    'Startet schlecht, geht aus oder Synchronisation verloren.',
    'Verdacht auf Versorgung, Masse, Signalunterbrechung oder Steuerzeitenproblem.'
  ],
  array[
    'Signal, Masse und Versorgung getrennt prüfen.',
    'Bei Synchronisationsfehlern Kurbelwelle und Nockenwelle gleichzeitig auf zwei Kanälen messen.',
    'Zeitbasis so wählen, dass mehrere Kurbelwellenumdrehungen sichtbar sind.'
  ],
  'Sauberes Rechtecksignal mit stabilen High-/Low-Pegeln. Kurbel- und Nockenwellensignal müssen phasenstabil zueinander laufen.',
  '[
    {"label":"Signalpegel","value":"typisch 0/5 V oder 0/Batteriespannung","condition":"systemabhängig","confidence":"systemabhängig","note":"Versorgungsspannung und Signalpegel nicht verwechseln."},
    {"label":"Flanken","value":"klar und wiederholbar","condition":"Starten und Leerlauf","confidence":"allgemein","note":"Runde, verschliffene oder fehlende Flanken deuten auf Leitung, Sensor oder Pull-up-Problem hin."}
  ]'::jsonb,
  '[
    {"title":"High-Pegel zu niedrig","symptom":"Signal wird sporadisch nicht erkannt.","signalClue":"Rechteck erreicht den erwarteten High-Pegel nicht.","nextCheck":"Versorgung, Masse, Pull-up, Leitung und Steuergeräte-Eingang prüfen.","severity":"warning"},
    {"title":"Phasenlage verschoben","symptom":"Synchronisationsfehler trotz vorhandener Signale.","signalClue":"KW/NW-Bezug passt nicht zum bekannten Gutbild.","nextCheck":"Steuerzeiten, Kette/Riemen, Versteller und Referenzsignal prüfen.","severity":"stop"}
  ]'::jsonb,
  array[
    'Steuerzeiten nur nach Herstellervorgaben bewerten.',
    'Arbeiten an Steuertrieb und rotierenden Teilen nur mit passender Qualifikation.'
  ],
  array[
    'Versorgung und Masse unter Last messen.',
    'Signal gegen Steuergeräte-Pin vergleichen, wenn am Sensor gut und am Steuergerät schlecht.',
    'Bei Phasenfehlern mechanische Steuerzeiten prüfen.'
  ],
  '[
    {"label":"Kurbelwelle","color":"#2563eb","unit":"V","scaleHint":"0/5 V oder 0/12 V","points":[0.08,0.08,0.9,0.9,0.08,0.08,0.9,0.9,0.08,0.08,0.9,0.9,0.08,0.08,0.9,0.9,0.08]},
    {"label":"Nockenwelle","color":"#16a34a","unit":"V","scaleHint":"Phasenbezug beachten","points":[0.08,0.08,0.08,0.86,0.86,0.86,0.08,0.08,0.08,0.08,0.86,0.86,0.08,0.08,0.08,0.86,0.86]}
  ]'::jsonb,
  array['hallgeber','nockenwellensensor','synchronisation','steuerzeiten'],
  'Allgemeines Referenzsignal. Für konkrete Phasenlage wird immer ein fahrzeugspezifisches Gutbild benötigt.',
  'approved'
),
(
  'can-bus-high-low',
  'CAN-Bus High / Low',
  'LIN/CAN',
  'Fahrzeugnetzwerk',
  'differenzielles Bussignal',
  'CAN arbeitet differenziell. Rezessiv liegen CAN-H und CAN-L ungefähr nahe beieinander, dominant laufen beide Leitungen auseinander.',
  array[
    'Mehrere Steuergeräte nicht erreichbar.',
    'U-Codes, Bus-Off, sporadische Kommunikationsabbrüche.',
    'Verdacht auf Kurzschluss, Terminierung, Störung oder falsches Nachrüstgerät.'
  ],
  array[
    'CAN-H und CAN-L zweikanalig gegen Masse oder differenziell messen.',
    'Masse am Fahrzeug sauber wählen und Tastkopf-Masse nicht falsch setzen.',
    'Bei ausgeschalteter Zündung Widerstandsmessung der Terminierung nur spannungsfrei durchführen.'
  ],
  'CAN-H steigt bei dominantem Bit, CAN-L fällt. Beide Signale sollen sauber spiegelbildlich und ohne starke Reflexionen laufen.',
  '[
    {"label":"Rezessiver Pegel","value":"typisch ungefähr 2,5 V auf beiden Leitungen","condition":"High-Speed-CAN, allgemeiner Richtwert","confidence":"allgemein","note":"Netzwerk und Messpunkt können Abweichungen zeigen."},
    {"label":"Dominanter Pegel","value":"typisch CAN-H ca. 3,5 V, CAN-L ca. 1,5 V","condition":"High-Speed-CAN, allgemeiner Richtwert","confidence":"allgemein","note":"Wichtig ist auch die Differenz und die saubere Signalform."},
    {"label":"Terminierung","value":"oft ca. 60 Ohm gesamt","condition":"spannungsfrei zwischen CAN-H und CAN-L","confidence":"systemabhängig","note":"Nur messen, wenn das Netzwerk spannungsfrei ist und die Topologie dazu passt."}
  ]'::jsonb,
  '[
    {"title":"Kurzschluss gegen Masse oder Plus","symptom":"Viele Steuergeräte offline.","signalClue":"Eine Leitung klebt nahe 0 V oder Batteriespannung.","nextCheck":"Bussegmente trennen, Nachrüstgeräte und Leitungsstränge eingrenzen.","severity":"stop"},
    {"title":"Reflexionen / Terminierung fehlerhaft","symptom":"Sporadische Kommunikationsfehler.","signalClue":"Überschwingen, starke Kantenreflexionen, unsaubere Pegel.","nextCheck":"Terminierung, Steckverbindungen, verdrillte Leitung und Abzweige prüfen.","severity":"warning"}
  ]'::jsonb,
  array[
    'Busleitungen nicht mit Prüflampe belasten.',
    'Vor Widerstandsmessung Spannung abschalten und Restspannung beachten.'
  ],
  array[
    'Fehlerspeicher aller erreichbaren Steuergeräte vergleichen.',
    'CAN-H/CAN-L Pegel und Terminierung prüfen.',
    'Auffällige Steuergeräte oder Nachrüstmodule abschnittsweise abtrennen.'
  ],
  '[
    {"label":"CAN-H","color":"#2563eb","unit":"V","scaleHint":"ca. 2,5 bis 3,5 V","points":[0.5,0.5,0.8,0.5,0.8,0.8,0.5,0.5,0.8,0.5,0.8,0.5,0.5,0.8,0.8,0.5]},
    {"label":"CAN-L","color":"#dc2626","unit":"V","scaleHint":"ca. 2,5 bis 1,5 V","points":[0.5,0.5,0.2,0.5,0.2,0.2,0.5,0.5,0.2,0.5,0.2,0.5,0.5,0.2,0.2,0.5]}
  ]'::jsonb,
  array['can','can-high','can-low','u-code','kommunikation','gateway'],
  'Allgemeine High-Speed-CAN-Referenz. Exakte Topologie und Terminierung fahrzeugabhängig prüfen.',
  'approved'
),
(
  'lin-bus-signal',
  'LIN-Bus',
  'LIN/CAN',
  'Karosserie / Komfort / Sensorik',
  'eindrahtiges serielles Bussignal',
  'LIN ist ein eindrahtiger Bus. In Ruhe liegt die Leitung meist nahe Batteriespannung, dominante Bits ziehen die Leitung gegen Masse.',
  array[
    'Kommunikationsfehler mit Generator, Klimasensor, Türmodul, Lüfter oder Komfortbauteil.',
    'Ein einzelner LIN-Teilnehmer reagiert nicht.',
    'Verdacht auf Kurzschluss, fehlende Versorgung oder defekten Slave.'
  ],
  array[
    'LIN-Leitung gegen Masse messen.',
    'Ruhepegel, Aktivität beim Ansteuern und Versorgung des Teilnehmers prüfen.',
    'Zeitbasis so wählen, dass Telegrammblöcke sichtbar sind.'
  ],
  'Ruhepegel nahe Batteriespannung, kurze Telegrammblöcke mit Pull-down-Impulsen nahe Masse. Signal soll klare Flanken haben.',
  '[
    {"label":"Ruhepegel","value":"typisch nahe Batteriespannung","condition":"LIN-Leitung unbelastet/rezessiv","confidence":"allgemein","note":"Je nach Fahrzeug und Messpunkt leicht abweichend."},
    {"label":"Dominanter Pegel","value":"typisch nahe 0 V","condition":"während Telegramm","confidence":"allgemein","note":"Bleibt die Leitung dauerhaft niedrig, Kurzschluss oder Teilnehmerfehler prüfen."}
  ]'::jsonb,
  '[
    {"title":"Leitung dauerhaft niedrig","symptom":"LIN-Kommunikation komplett ausgefallen.","signalClue":"Keine Rückkehr zum Ruhepegel.","nextCheck":"Teilnehmer nacheinander abstecken, Leitung auf Massekurzschluss prüfen.","severity":"warning"},
    {"title":"Keine Aktivität trotz Ansteuerung","symptom":"Bauteil reagiert nicht, aber Versorgung liegt an.","signalClue":"LIN bleibt dauerhaft auf Ruhepegel.","nextCheck":"Master-Ansteuerung, Diagnoseanforderung und Leitung zum Steuergerät prüfen.","severity":"warning"}
  ]'::jsonb,
  array['LIN nicht mit Prüflampe belasten.'],
  array[
    'Versorgung und Masse des LIN-Teilnehmers messen.',
    'LIN-Aktivität beim Stellgliedtest prüfen.',
    'Bei Busblockade Teilnehmer abschnittsweise trennen.'
  ],
  '[
    {"label":"LIN","color":"#7c3aed","unit":"V","scaleHint":"0 V bis Batteriespannung","points":[0.88,0.88,0.12,0.88,0.12,0.12,0.88,0.88,0.12,0.88,0.88,0.12,0.12,0.88,0.88,0.88]}
  ]'::jsonb,
  array['lin','generator lin','komfort','klima','lüfter','kommunikation'],
  'Allgemeines LIN-Referenzsignal. Baudrate und Telegrammaufbau sind systemabhängig.',
  'approved'
),
(
  'einspritzventil-magnetventil',
  'Einspritzventil Magnetventil',
  'Einspritzung',
  'Kraftstoff / Einspritzung',
  'Spannungs- und Stromsignal',
  'Magnetische Einspritzventile zeigen eine Ansteuerphase, Stromrampe und beim Abschalten eine Induktionsspitze.',
  array[
    'Zylinderaussetzer, Startprobleme oder Kraftstofffehler.',
    'Verdacht auf fehlende Ansteuerung, defekte Spule oder mechanisch klemmendes Ventil.',
    'Vergleich zwischen Zylindern nötig.'
  ],
  array[
    'Stromzange um die Versorgungs- oder Steuerleitung legen.',
    'Zusätzlich Spannung am Ventil oder Steuerleitung messen, wenn möglich mit Adapter.',
    'Zylinder unter gleichen Bedingungen miteinander vergleichen.'
  ],
  'Strom steigt während der Ansteuerung rampenförmig an. Beim Abschalten entsteht eine deutliche Induktionsspitze im Spannungssignal.',
  '[
    {"label":"Stromrampe","value":"Form und Gleichmäßigkeit wichtiger als ein Pauschalwert","condition":"bauart- und steuergeräteabhängig","confidence":"nur Vergleich","note":"Zylindervergleich ist oft aussagekräftiger als ein generischer Einzelwert."},
    {"label":"Induktionsspitze","value":"deutlich sichtbar","condition":"beim Abschalten","confidence":"allgemein","note":"Fehlt sie, Spule, Freilaufpfad, Verkabelung oder Treiber prüfen."}
  ]'::jsonb,
  '[
    {"title":"Keine Stromrampe","symptom":"Zylinder arbeitet nicht.","signalClue":"Spannung vorhanden, aber kein Stromanstieg.","nextCheck":"Ventilspule, Steckkontakt, Leitung und Treiber prüfen.","severity":"warning"},
    {"title":"Auffälliger Stromknick","symptom":"Unruhiger Lauf oder Aussetzer.","signalClue":"Rampenform weicht vom Zylindervergleich ab.","nextCheck":"Ventil mechanisch, Kraftstoffdruck und Steuergerät-Ausgang vergleichen.","severity":"warning"}
  ]'::jsonb,
  array[
    'Kraftstoffsysteme stehen unter Druck.',
    'Bei Hochdruck-Diesel keine Leitungen bei laufendem Motor lösen.'
  ],
  array[
    'Zylindervergleich mit gleicher Zeitbasis durchführen.',
    'Widerstand nur ergänzend und nach Herstellerdaten bewerten.',
    'Bei mechanischem Verdacht Rücklaufmenge, Kompression und Kraftstoffdruck prüfen.'
  ],
  '[
    {"label":"Strom","color":"#16a34a","unit":"A","scaleHint":"stromzangenabhängig","points":[0.04,0.1,0.16,0.23,0.3,0.38,0.47,0.57,0.67,0.78,0.9,0.1,0.06,0.05,0.12,0.2,0.28,0.37,0.47,0.58,0.7,0.84,0.94,0.12]},
    {"label":"Spannung","color":"#2563eb","unit":"V","scaleHint":"Bordnetz plus Abschaltspitze","points":[0.82,0.82,0.18,0.18,0.18,0.18,0.98,0.82,0.82,0.82,0.18,0.18,0.18,0.98,0.82,0.82]}
  ]'::jsonb,
  array['einspritzventil','injektor','stromrampe','zylinderaussetzer'],
  'Allgemeines Magnetventil-Referenzsignal. Direkteinspritzung und Diesel-Injektoren können stark abweichen.',
  'approved'
),
(
  'zuendspule-primaersignal',
  'Zündspule Primärsignal',
  'Zündung',
  'Zündanlage',
  'Primärspannung und Primärstrom',
  'Das Primärsignal zeigt Schließzeit, Stromaufbau und Abschaltvorgang. Es hilft bei Aussetzern, Spulenfehlern und Treiberproblemen.',
  array[
    'Zylinderaussetzer bei Ottomotoren.',
    'Verdacht auf defekte Zündspule, Ansteuerung oder Versorgung.',
    'Vergleich einzelner Zylinder unter Last.'
  ],
  array[
    'Primärseite nur mit geeignetem Tastkopf und passender Spannungskategorie messen.',
    'Stromzange für Primärstrom verwenden, wenn Spannungsspitzen kritisch sind.',
    'Zylindervergleich durchführen und Messbereich vor Start hoch genug wählen.'
  ],
  'Stromrampe während der Schließzeit, danach Abschaltspitze und Schwingung. Verlauf soll zylinderweise ähnlich sein.',
  '[
    {"label":"Schließzeit","value":"steuergeräte- und drehzahlabhängig","condition":"Leerlauf und Last vergleichen","confidence":"systemabhängig","note":"Nicht pauschal bewerten; Diagnose über Vergleich und Ansteuerlogik."},
    {"label":"Primärspannung","value":"hohe Abschaltspitzen möglich","condition":"beim Abschalten","confidence":"allgemein","note":"Nur mit geeignetem Messmittel messen."}
  ]'::jsonb,
  '[
    {"title":"Stromrampe bricht ab","symptom":"Aussetzer auf einem Zylinder.","signalClue":"Primärstrom erreicht nicht den Vergleichswert.","nextCheck":"Versorgung, Masse, Spule und Steuergerätetreiber prüfen.","severity":"warning"},
    {"title":"Keine Abschaltspitze","symptom":"Kein Zündfunke.","signalClue":"Ansteuerung ohne induktive Reaktion.","nextCheck":"Spule, Primärkreis, Treiber und Steckverbindung prüfen.","severity":"warning"}
  ]'::jsonb,
  array[
    'Zündanlagen erzeugen hohe Spannungen. Nur geeignete Messmittel verwenden.',
    'Nicht an Sekundärseite oder Zündleitungen arbeiten, wenn die Anlage aktiv ist.'
  ],
  array[
    'Fehlzündungszähler je Zylinder prüfen.',
    'Spule testweise zylinderweise quer tauschen, wenn fachlich vertretbar.',
    'Versorgung und Masse unter Last prüfen.'
  ],
  '[
    {"label":"Primärstrom","color":"#16a34a","unit":"A","scaleHint":"Spulenabhängig","points":[0.04,0.1,0.16,0.23,0.3,0.38,0.47,0.57,0.67,0.78,0.9,0.1,0.06,0.05,0.12,0.2,0.28,0.37,0.47,0.58,0.7,0.84,0.94,0.12]},
    {"label":"Primärspannung","color":"#dc2626","unit":"V","scaleHint":"Abschaltspitze beachten","points":[0.78,0.18,0.18,0.18,0.18,0.95,0.7,0.84,0.73,0.78,0.18,0.18,0.18,0.95,0.72,0.8]}
  ]'::jsonb,
  array['zündspule','zündung','misfire','aussetzer','primärsignal'],
  'Allgemeines Primärsignal. Sekundärdiagnose und genaue Werte sind systemabhängig.',
  'approved'
),
(
  'lambdasonde-sprungsonde',
  'Lambdasonde Sprungsonde',
  'Lambdasonde',
  'Gemischregelung',
  'Spannungssignal',
  'Eine klassische Sprungsonde pendelt bei aktiver Regelung zwischen mager und fett. Das Signal ist nur im geschlossenen Regelkreis sinnvoll bewertbar.',
  array[
    'Gemischfehler, erhöhter Verbrauch oder AU-Probleme.',
    'Verdacht auf träge Sonde, Falschluft oder Kraftstoffdruckproblem.',
    'Vergleich Sonde vor und nach Katalysator.'
  ],
  array[
    'Sondensignal hochohmig messen, Massebezug sauber wählen.',
    'Motor betriebswarm prüfen und Regelzustand im Tester beachten.',
    'Fuel Trims und Lambdaregelung parallel betrachten.'
  ],
  'Vor Kat bei aktiver Regelung regelmäßiges Pendeln zwischen niedrigem und hohem Spannungsbereich. Nach Kat deutlich ruhiger.',
  '[
    {"label":"Sprungsonde vor Kat","value":"typisch grob ca. 0,1 bis 0,9 V pendelnd","condition":"betriebswarm, geschlossener Regelkreis","confidence":"allgemein","note":"Regelstrategie, Sondentyp und Fahrzeugzustand beachten."},
    {"label":"Trägheit","value":"nur im Vergleich sicher bewerten","condition":"gezielte Anfettung/Abmagerung","confidence":"nur Vergleich","note":"Eine scheinbar träge Sonde kann auch Folge eines Gemischproblems sein."}
  ]'::jsonb,
  '[
    {"title":"Signal bleibt mager","symptom":"Gemischfehler mager, Ruckeln, Fuel Trim positiv.","signalClue":"Sonde bleibt lange im niedrigen Bereich.","nextCheck":"Falschluft, Kraftstoffdruck, Abgasleck vor Sonde und Sondenheizung prüfen.","severity":"warning"},
    {"title":"Sonde pendelt nicht","symptom":"Regelung inaktiv oder AU-Wert auffällig.","signalClue":"Signal flach trotz warmem Motor.","nextCheck":"Regelkreisstatus, Heizung, Signalmasse und Gemischreaktion prüfen.","severity":"warning"}
  ]'::jsonb,
  array['Abgasanlage ist heiß. Brand- und Verbrennungsgefahr beachten.'],
  array[
    'Regelkreisstatus und Fuel Trims prüfen.',
    'Gezielt Falschluft oder Anfettung simulieren, wenn fachlich zulässig.',
    'Abgasleck vor Sonde ausschließen.'
  ],
  '[
    {"label":"Sondenspannung","color":"#ea580c","unit":"V","scaleHint":"ca. 0,1 bis 0,9 V","points":[0.18,0.2,0.82,0.85,0.22,0.18,0.8,0.86,0.2,0.18,0.82,0.84,0.25,0.2,0.78,0.84]}
  ]'::jsonb,
  array['lambdasonde','sprungsonde','gemisch','fuel trim','kat'],
  'Allgemeines Sprungsondenbild. Breitbandsonden werden anders bewertet.',
  'approved'
),
(
  'drucksensor-5v-signal',
  'Drucksensor 5-V-Signal',
  'Drucksensor',
  'Sensorik / Druckmessung',
  'analoges Sensorsignal',
  'Viele Drucksensoren arbeiten mit 5-V-Referenz, Masse und analogem Signal. Das Signal liegt typischerweise innerhalb eines plausiblen Fensters.',
  array[
    'Ladedruck-, Raildruck-, Klimadruck- oder Differenzdruckfehler.',
    'Signal unplausibel, Kurzschluss nach Plus/Masse oder Referenzspannungsfehler.',
    'Soll-/Ist-Abweichung im Tester.'
  ],
  array[
    '5-V-Referenz, Masse und Signal getrennt prüfen.',
    'Signal unter Zustandsänderung beobachten, nicht nur Standwert bewerten.',
    'Sensorstecker und Leitung am Steuergerät vergleichen, wenn Leitungsfehler möglich ist.'
  ],
  'Signal bewegt sich gleichmäßig mit Druckänderung. Keine Sprünge, Aussetzer oder Festwerte am Anschlag.',
  '[
    {"label":"Signalbereich","value":"häufig grob ca. 0,5 bis 4,5 V","condition":"typischer 5-V-Analogdrucksensor","confidence":"systemabhängig","note":"Exakte Kennlinie ist sensorspezifisch."},
    {"label":"Referenzspannung","value":"typisch 5 V","condition":"Zündung ein","confidence":"allgemein","note":"Belastung, Masseversatz und gemeinsame 5-V-Schiene beachten."}
  ]'::jsonb,
  '[
    {"title":"Signal am Anschlag","symptom":"Plausibilitätsfehler oder Ersatzwert.","signalClue":"Signal klebt nahe 0 V oder nahe Referenzspannung.","nextCheck":"Kurzschluss, Leitungsunterbrechung, Masse und Sensor prüfen.","severity":"warning"},
    {"title":"Signal springt","symptom":"Sporadischer Fehler, Regelung instabil.","signalClue":"Kurze Aussetzer oder harte Sprünge ohne reale Druckänderung.","nextCheck":"Stecker, Kabelzug, Masseversatz und Sensor mechanisch prüfen.","severity":"warning"}
  ]'::jsonb,
  array[
    'Kraftstoff- und Klimasysteme können unter hohem Druck stehen.',
    'Kältemittelarbeiten nur mit zugelassener Ausrüstung.'
  ],
  array[
    'Signalwert mit Diagnosetester-Live-Daten vergleichen.',
    '5-V-Schiene auf weitere Sensorfehler prüfen.',
    'Bei Drucksystemen mechanischen Istzustand mit Manometer oder Herstellervorgabe absichern.'
  ],
  '[
    {"label":"Signal","color":"#2563eb","unit":"V","scaleHint":"typisch innerhalb 0,5 bis 4,5 V","points":[0.22,0.25,0.28,0.34,0.38,0.44,0.5,0.58,0.64,0.72,0.78,0.74,0.66,0.55,0.43,0.32]},
    {"label":"5-V-Referenz","color":"#16a34a","unit":"V","scaleHint":"stabil","points":[0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9,0.9]}
  ]'::jsonb,
  array['drucksensor','5v','ladedrucksensor','raildrucksensor','klimadruck'],
  'Allgemeines Analogsignal. Kennlinie und Druckwert immer systemspezifisch prüfen.',
  'approved'
),
(
  'pumpe-stromaufnahme',
  'Stromaufnahme Pumpe / Stellmotor',
  'Stromaufnahme',
  'Aktoren / Elektromotoren',
  'Stromzangenmessung',
  'Die Stromaufnahme zeigt Anlaufstrom, Lastzustand und Kommutatorwelligkeit. Sie hilft bei Pumpen, Lüftern und Stellmotoren.',
  array[
    'Pumpe läuft nicht, läuft laut oder bringt zu wenig Leistung.',
    'Sicherung löst aus oder Motor zieht zu viel Strom.',
    'Verdacht auf mechanische Blockade, Verschleiß oder Spannungsabfall.'
  ],
  array[
    'Stromzange um eine einzelne Versorgungsleitung legen.',
    'Spannung am Verbraucher parallel messen, wenn Lastproblem möglich ist.',
    'Anlauf und stabilen Lauf getrennt beurteilen.'
  ],
  'Kurzer Anlaufstrom, danach stabiler Strom mit regelmäßiger Welligkeit. Unregelmäßige Spitzen deuten auf Kommutator- oder Lastprobleme.',
  '[
    {"label":"Anlaufstrom","value":"kurzzeitig höher als Laufstrom","condition":"Start des Motors","confidence":"allgemein","note":"Höhe ist stark abhängig von Motor, Pumpe, Temperatur und Versorgung."},
    {"label":"Welligkeit","value":"regelmäßig und wiederholbar","condition":"stabiler Lauf","confidence":"nur Vergleich","note":"Vergleich mit bekannt gutem Bauteil oder mehreren Betriebszuständen ist wichtig."}
  ]'::jsonb,
  '[
    {"title":"Hoher Strom mit niedriger Drehzahl","symptom":"Pumpe brummt, Sicherung belastet, Stellmotor schwergängig.","signalClue":"Strom deutlich hoch, Welligkeit langsam oder unregelmäßig.","nextCheck":"Mechanische Blockade, Lager, Pumpe, Leitung und Versorgung prüfen.","severity":"warning"},
    {"title":"Strom fällt immer wieder ab","symptom":"Motor setzt aus.","signalClue":"Aussetzer oder Lücken im Stromverlauf.","nextCheck":"Stecker, Relais, PWM-Ansteuerung, Versorgung und Masse unter Last prüfen.","severity":"warning"}
  ]'::jsonb,
  array[
    'Lüfter und Pumpen können unerwartet anlaufen.',
    'Bei Kraftstoffpumpen Brandgefahr und Druck im System beachten.'
  ],
  array[
    'Spannungsversorgung unter Last parallel prüfen.',
    'Strombild mit Geräusch, Druck/Förderleistung oder Stellweg vergleichen.',
    'Wenn der Strom auffällig ist, mechanische Last nicht nur elektrisch bewerten.'
  ],
  '[
    {"label":"Stromaufnahme","color":"#0f766e","unit":"A","scaleHint":"Anlauf plus Laufstrom","points":[0.02,0.78,0.55,0.5,0.56,0.48,0.55,0.49,0.57,0.47,0.54,0.5,0.56,0.48,0.55,0.49]}
  ]'::jsonb,
  array['stromaufnahme','pumpe','stellmotor','stromzange','lüfter','kraftstoffpumpe'],
  'Allgemeines Strombild. Stromhöhe und Welligkeit müssen mit konkretem Verbraucher verglichen werden.',
  'approved'
)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  system_group = excluded.system_group,
  signal_type = excluded.signal_type,
  summary = excluded.summary,
  when_to_use = excluded.when_to_use,
  measurement_setup = excluded.measurement_setup,
  expected_pattern = excluded.expected_pattern,
  reference_values = excluded.reference_values,
  common_faults = excluded.common_faults,
  safety_notes = excluded.safety_notes,
  next_checks = excluded.next_checks,
  channels = excluded.channels,
  tags = excluded.tags,
  source_note = excluded.source_note,
  status = excluded.status,
  updated_at = now();
