update public.diagnosis_correction_suggestions
set
  suggested_correction = 'Nicht pauschal zum Warmfahren auffordern. Öltemperatur nach Herstellerdaten mit Diagnosetester prüfen. Öl nicht im heißen Zustand ablassen. Bei DQ250-DSG-Getriebeölwechsel nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen. Wenn kein sicherer Temperaturwert hinterlegt ist, Temperaturfenster als fehlende Herstellerangabe kennzeichnen.',
  approved_rule = 'Bei DSG- oder Automatikgetriebeöl-Arbeiten niemals pauschal schreiben, dass das Getriebe warmgefahren und dann das Öl abgelassen werden soll. Stattdessen: Öltemperatur nach Herstellerdaten mit Diagnosetester prüfen, Öl nicht heiß ablassen, Verbrennungsgefahr nur bei realem Heißölrisiko nennen und fehlende Temperaturfenster klar als Herstellerdaten markieren. Bei DQ250-DSG-Getriebeölwechsel nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen.',
  updated_at = now()
where
  status = 'approved'
  and title = 'DSG- und Automatikgetriebeöl nicht heiß ablassen';
