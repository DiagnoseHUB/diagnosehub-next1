package de.diagnosehub.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final String PREFS_NAME = "diagnosehub_native_session";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_EXPIRES_AT = "expires_at";
    private static final String KEY_EMAIL = "email";

    private static final int COLOR_BACKGROUND = Color.rgb(2, 6, 23);
    private static final int COLOR_SURFACE = Color.rgb(15, 23, 42);
    private static final int COLOR_SURFACE_LIGHT = Color.rgb(30, 41, 59);
    private static final int COLOR_BORDER = Color.rgb(51, 65, 85);
    private static final int COLOR_TEXT = Color.rgb(248, 250, 252);
    private static final int COLOR_MUTED = Color.rgb(203, 213, 225);
    private static final int COLOR_BLUE = Color.rgb(37, 99, 235);
    private static final int COLOR_GREEN = Color.rgb(22, 163, 74);
    private static final int COLOR_WARNING = Color.rgb(250, 204, 21);
    private static final int COLOR_DANGER = Color.rgb(248, 113, 113);

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ArrayList<ChatMessage> diagnosisMessages = new ArrayList<>();

    private LinearLayout content;
    private TextView accountStatus;
    private Button diagnoseTabButton;
    private Button guideTabButton;
    private Button learningTabButton;
    private Button accountTabButton;
    private Button workshopModeButton;
    private Button hobbyModeButton;

    private TextView diagnosisOutput;
    private TextView guideOutput;
    private TextView learningOutput;

    private Session session;
    private String currentTab = "diagnose";
    private String audienceMode = "workshop";
    private final String apiBaseUrl = normalizeBaseUrl(BuildConfig.DIAGNOSEHUB_API_BASE_URL);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(COLOR_BACKGROUND);
        getWindow().setNavigationBarColor(COLOR_BACKGROUND);

        session = loadSession();
        buildShell();
        showDiagnoseScreen();
    }

    @Override
    protected void onDestroy() {
        networkExecutor.shutdownNow();
        super.onDestroy();
    }

    private void buildShell() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(COLOR_BACKGROUND);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18), dp(18), dp(18), dp(28));
        scrollView.addView(page, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView eyebrow = text("DiagnoseHUB Beta 0.9", 13, COLOR_MUTED, Typeface.BOLD);
        page.addView(eyebrow);

        TextView title = text("Native Diagnose", 31, COLOR_TEXT, Typeface.BOLD);
        title.setPadding(0, dp(6), 0, dp(6));
        page.addView(title);

        TextView subtitle = text(
                "Diagnose, Anleitung und Lernwissen als Android-App. Die Antworten werden genauer, je mehr Fahrzeugdaten du eingibst.",
                15,
                COLOR_MUTED,
                Typeface.NORMAL
        );
        page.addView(subtitle);

        accountStatus = text("", 13, COLOR_MUTED, Typeface.BOLD);
        accountStatus.setPadding(0, dp(12), 0, dp(10));
        page.addView(accountStatus);
        refreshAccountStatus();

        page.addView(buildAudienceModeCard());
        page.addView(buildTabRow());

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, dp(14), 0, 0);
        page.addView(content);

        setContentView(scrollView);
    }

    private View buildAudienceModeCard() {
        LinearLayout card = card();
        TextView label = text("Ausgabemodus", 13, COLOR_MUTED, Typeface.BOLD);
        card.addView(label);

        LinearLayout row = row();
        workshopModeButton = pillButton("Werkstatt");
        hobbyModeButton = pillButton("Hobby");

        workshopModeButton.setOnClickListener(view -> {
            audienceMode = "workshop";
            refreshModeButtons();
        });
        hobbyModeButton.setOnClickListener(view -> {
            audienceMode = "hobby";
            refreshModeButtons();
        });

        row.addView(workshopModeButton, weightParams());
        row.addView(hobbyModeButton, weightParams());
        card.addView(row);

        TextView hint = text(
                "Hobby: normale Sprache, Risiko, Werkzeug. Werkstatt: Messwerte, Prüfpfad, Entscheidung.",
                13,
                COLOR_MUTED,
                Typeface.NORMAL
        );
        hint.setPadding(0, dp(10), 0, 0);
        card.addView(hint);

        refreshModeButtons();
        return card;
    }

    private View buildTabRow() {
        LinearLayout row = row();
        row.setPadding(0, dp(12), 0, 0);

        diagnoseTabButton = tabButton("Diagnose", "diagnose");
        guideTabButton = tabButton("Anleitung", "guide");
        learningTabButton = tabButton("Lernen", "learning");
        accountTabButton = tabButton("Konto", "account");

        row.addView(diagnoseTabButton, weightParams());
        row.addView(guideTabButton, weightParams());
        row.addView(learningTabButton, weightParams());
        row.addView(accountTabButton, weightParams());

        refreshTabs();
        return row;
    }

    private Button tabButton(String label, String tab) {
        Button button = pillButton(label);
        button.setTextSize(12);
        button.setOnClickListener(view -> {
            if ("diagnose".equals(tab)) {
                showDiagnoseScreen();
            } else if ("guide".equals(tab)) {
                showGuideScreen();
            } else if ("learning".equals(tab)) {
                showLearningScreen();
            } else {
                showAccountScreen();
            }
        });
        return button;
    }

    private void showDiagnoseScreen() {
        currentTab = "diagnose";
        refreshTabs();
        content.removeAllViews();

        LinearLayout card = card();
        card.addView(text("Diagnose", 22, COLOR_TEXT, Typeface.BOLD));
        card.addView(paragraph(
                "Ein Feld reicht: Fehlercode, Symptom, Messwert oder Anleitungshinweis eingeben. Fahrzeugdaten machen die Antwort deutlich präziser."
        ));

        EditText vehicleInput = editText(
                "Fahrzeugdaten: Marke, Modell, Baujahr, Motorcode, Kilometerstand",
                2
        );
        EditText diagnosisInput = editText(
                "Beispiel: VW Passat 2.0 TDI, P0299, Leistungsverlust ab 2500 U/min, Ladedruck Ist 1400 mbar",
                5
        );

        card.addView(label("Fahrzeugdaten"));
        card.addView(vehicleInput);
        card.addView(label("Fehlercode, Symptom oder Frage"));
        card.addView(diagnosisInput);

        LinearLayout actions = row();
        Button sendButton = actionButton("Diagnose starten", COLOR_BLUE);
        Button clearButton = outlineButton("Verlauf löschen");
        actions.addView(sendButton, weightParams());
        actions.addView(clearButton, weightParams());
        card.addView(actions);

        diagnosisOutput = outputBox();
        card.addView(diagnosisOutput);
        renderDiagnosisHistory();

        sendButton.setOnClickListener(view -> sendDiagnosis(vehicleInput, diagnosisInput, sendButton));
        clearButton.setOnClickListener(view -> {
            diagnosisMessages.clear();
            renderDiagnosisHistory();
        });

        content.addView(card);
        content.addView(disclaimer());
    }

    private void showGuideScreen() {
        currentTab = "guide";
        refreshTabs();
        content.removeAllViews();

        LinearLayout card = card();
        card.addView(text("Anleitung", 22, COLOR_TEXT, Typeface.BOLD));
        card.addView(paragraph(
                "Native Anleitungssuche mit Werkzeugliste, Schwierigkeit, Prüfschritten und Sicherheitsgrenzen."
        ));

        EditText guideInput = editText(
                "Beispiel: Qashqai Gebläsemotor ausbauen oder Golf 7 AGR-Ventil prüfen",
                4
        );
        card.addView(label("Bauteil, Arbeit oder Diagnoseziel"));
        card.addView(guideInput);

        Button generateButton = actionButton("Anleitung erstellen", COLOR_BLUE);
        card.addView(generateButton);

        guideOutput = outputBox();
        card.addView(guideOutput);
        guideOutput.setText("Noch keine Anleitung geladen.");

        generateButton.setOnClickListener(view -> sendGuideRequest(guideInput, generateButton));

        content.addView(card);
        content.addView(disclaimer());
    }

    private void showLearningScreen() {
        currentTab = "learning";
        refreshTabs();
        content.removeAllViews();

        LinearLayout card = card();
        card.addView(text("Lernen", 22, COLOR_TEXT, Typeface.BOLD));
        card.addView(paragraph(
                "Bauteilwissen für Ausbildung und Werkstatt: Aufgaben, Klemmen, Messwerte, Zusammenspiel und typische Fehler."
        ));

        EditText learningInput = editText(
                "Beispiel: Erkläre einen NTC oder welche Klemmen hat ein Wechslerrelais?",
                4
        );
        card.addView(label("Lernthema"));
        card.addView(learningInput);

        LinearLayout quickOne = row();
        quickOne.addView(quickTopicButton("NTC erklären", learningInput), weightParams());
        quickOne.addView(quickTopicButton("Wechslerrelais", learningInput), weightParams());
        card.addView(quickOne);

        LinearLayout quickTwo = row();
        quickTwo.addView(quickTopicButton("Drehstromgenerator", learningInput), weightParams());
        quickTwo.addView(quickTopicButton("Halogen 12 V", learningInput), weightParams());
        card.addView(quickTwo);

        Button learnButton = actionButton("Wissen laden", COLOR_BLUE);
        card.addView(learnButton);

        learningOutput = outputBox();
        card.addView(learningOutput);
        learningOutput.setText("Noch kein Lerninhalt geladen.");

        learnButton.setOnClickListener(view -> sendLearningRequest(learningInput, learnButton));

        content.addView(card);
        content.addView(disclaimer());
    }

    private void showAccountScreen() {
        currentTab = "account";
        refreshTabs();
        content.removeAllViews();

        LinearLayout card = card();
        card.addView(text("Konto", 22, COLOR_TEXT, Typeface.BOLD));

        if (session != null) {
            card.addView(paragraph("Angemeldet als " + safe(session.email) + "."));

            Button openProfile = actionButton("Profil und Tarif öffnen", COLOR_BLUE);
            Button logout = outlineButton("Abmelden");
            card.addView(openProfile);
            card.addView(logout);

            openProfile.setOnClickListener(view -> openWeb("/dashboard"));
            logout.setOnClickListener(view -> {
                clearSession();
                diagnosisMessages.clear();
                refreshAccountStatus();
                showAccountScreen();
            });
        } else {
            card.addView(paragraph(
                    "Melde dich mit deinem DiagnoseHUB-Konto an. Neue Konten richtest du im Browser ein."
            ));

            EditText emailInput = editText("E-Mail", 1);
            emailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
            EditText passwordInput = editText("Passwort", 1);
            passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);

            card.addView(label("E-Mail"));
            card.addView(emailInput);
            card.addView(label("Passwort"));
            card.addView(passwordInput);

            Button login = actionButton("Anmelden", COLOR_BLUE);
            Button createAccount = outlineButton("Account einrichten");
            card.addView(login);
            card.addView(createAccount);

            login.setOnClickListener(view -> login(emailInput, passwordInput, login));
            createAccount.setOnClickListener(view -> openWeb("/login"));
        }

        content.addView(card);
        content.addView(disclaimer());
    }

    private void sendDiagnosis(EditText vehicleInput, EditText diagnosisInput, Button button) {
        String vehicle = vehicleInput.getText().toString().trim();
        String diagnosis = diagnosisInput.getText().toString().trim();

        if (diagnosis.length() < 2) {
            toast("Bitte Fehlercode, Symptom oder Frage eingeben.");
            return;
        }

        String input = "Fahrzeugdaten:\n"
                + (vehicle.isEmpty() ? "Nicht angegeben" : vehicle)
                + "\n\nDiagnose / Fehlercode / Frage:\n"
                + diagnosis
                + "\n\nAusgabemodus:\n"
                + ("hobby".equals(audienceMode) ? "Hobby-Modus" : "Werkstatt-Modus");

        setBusy(button, "Diagnose läuft...");
        withFreshSession(activeSession -> {
            try {
                JSONObject body = new JSONObject();
                body.put("input", input);
                body.put("messages", toMessageArray());
                body.put("audienceMode", audienceMode);
                body.put("accessToken", activeSession.accessToken);

                postJson("/api/diagnose", body, activeSession.accessToken, new JsonCallback() {
                    @Override
                    public void onSuccess(JSONObject response) {
                        restoreButton(button, "Diagnose starten");
                        String result = response.optString("result", "").trim();
                        String quality = response.optString("qualityCheck", "").trim();
                        if (result.isEmpty()) {
                            result = "Die Diagnose hat keine auslesbare Antwort geliefert.";
                        }
                        diagnosisMessages.add(new ChatMessage("user", input, audienceMode));
                        diagnosisMessages.add(new ChatMessage("assistant", appendQuality(result, quality), audienceMode));
                        diagnosisInput.setText("");
                        renderDiagnosisHistory();
                    }

                    @Override
                    public void onError(String message) {
                        restoreButton(button, "Diagnose starten");
                        setOutput(diagnosisOutput, "Fehler: " + message, true);
                    }
                });
            } catch (Exception error) {
                restoreButton(button, "Diagnose starten");
                setOutput(diagnosisOutput, "Fehler: " + error.getMessage(), true);
            }
        }, message -> {
            restoreButton(button, "Diagnose starten");
            setOutput(diagnosisOutput, message, true);
        });
    }

    private void sendGuideRequest(EditText guideInput, Button button) {
        String query = guideInput.getText().toString().trim();

        if (query.length() < 2) {
            toast("Bitte Thema oder Arbeit eingeben.");
            return;
        }

        setBusy(button, "Anleitung läuft...");
        withFreshSession(activeSession -> {
            try {
                JSONObject body = new JSONObject();
                body.put("query", query);
                body.put("source", "search");

                postJson("/api/anleitungen/generate", body, activeSession.accessToken, new JsonCallback() {
                    @Override
                    public void onSuccess(JSONObject response) {
                        restoreButton(button, "Anleitung erstellen");
                        JSONObject guide = response.optJSONObject("guide");
                        if (guide == null) {
                            setOutput(guideOutput, response.toString(), false);
                            return;
                        }
                        setOutput(guideOutput, formatGuide(guide), false);
                    }

                    @Override
                    public void onError(String message) {
                        restoreButton(button, "Anleitung erstellen");
                        setOutput(guideOutput, "Fehler: " + message, true);
                    }
                });
            } catch (Exception error) {
                restoreButton(button, "Anleitung erstellen");
                setOutput(guideOutput, "Fehler: " + error.getMessage(), true);
            }
        }, message -> {
            restoreButton(button, "Anleitung erstellen");
            setOutput(guideOutput, message, true);
        });
    }

    private void sendLearningRequest(EditText learningInput, Button button) {
        String query = learningInput.getText().toString().trim();

        if (query.length() < 2) {
            toast("Bitte Lernthema eingeben.");
            return;
        }

        setBusy(button, "Wissen wird geladen...");
        withFreshSession(activeSession -> {
            try {
                JSONObject body = new JSONObject();
                body.put("query", query);

                postJson("/api/lernen/wissen", body, activeSession.accessToken, new JsonCallback() {
                    @Override
                    public void onSuccess(JSONObject response) {
                        restoreButton(button, "Wissen laden");
                        String answer = response.optString("answer", "").trim();
                        if (answer.isEmpty()) {
                            answer = "Es wurde kein Lerninhalt geliefert.";
                        }
                        setOutput(learningOutput, answer, false);
                    }

                    @Override
                    public void onError(String message) {
                        restoreButton(button, "Wissen laden");
                        setOutput(learningOutput, "Fehler: " + message, true);
                    }
                });
            } catch (Exception error) {
                restoreButton(button, "Wissen laden");
                setOutput(learningOutput, "Fehler: " + error.getMessage(), true);
            }
        }, message -> {
            restoreButton(button, "Wissen laden");
            setOutput(learningOutput, message, true);
        });
    }

    private void login(EditText emailInput, EditText passwordInput, Button button) {
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();

        if (email.isEmpty() || password.isEmpty()) {
            toast("Bitte E-Mail und Passwort eingeben.");
            return;
        }

        setBusy(button, "Anmeldung...");

        try {
            JSONObject body = new JSONObject();
            body.put("email", email);
            body.put("password", password);

            postJson("/api/mobile/auth/login", body, null, new JsonCallback() {
                @Override
                public void onSuccess(JSONObject response) {
                    restoreButton(button, "Anmelden");
                    try {
                        session = sessionFromJson(response);
                        saveSession(session);
                        refreshAccountStatus();
                        toast("Angemeldet.");
                        showDiagnoseScreen();
                    } catch (Exception error) {
                        toast(error.getMessage());
                    }
                }

                @Override
                public void onError(String message) {
                    restoreButton(button, "Anmelden");
                    toast(message);
                }
            });
        } catch (Exception error) {
            restoreButton(button, "Anmelden");
            toast(error.getMessage());
        }
    }

    private void withFreshSession(SessionConsumer consumer, ErrorCallback errorCallback) {
        if (session == null || session.accessToken.isEmpty()) {
            errorCallback.onError("Bitte zuerst im Konto-Tab anmelden.");
            return;
        }

        long now = System.currentTimeMillis() / 1000L;
        if (session.expiresAtSeconds > now + 120 || session.refreshToken.isEmpty()) {
            consumer.onReady(session);
            return;
        }

        try {
            JSONObject body = new JSONObject();
            body.put("refreshToken", session.refreshToken);

            postJson("/api/mobile/auth/refresh", body, null, new JsonCallback() {
                @Override
                public void onSuccess(JSONObject response) {
                    try {
                        session = sessionFromJson(response);
                        saveSession(session);
                        refreshAccountStatus();
                        consumer.onReady(session);
                    } catch (Exception error) {
                        clearSession();
                        errorCallback.onError("Bitte erneut anmelden.");
                    }
                }

                @Override
                public void onError(String message) {
                    clearSession();
                    refreshAccountStatus();
                    errorCallback.onError("Session abgelaufen. Bitte erneut anmelden.");
                }
            });
        } catch (Exception error) {
            errorCallback.onError(error.getMessage());
        }
    }

    private void postJson(String path, JSONObject body, String accessToken, JsonCallback callback) {
        networkExecutor.execute(() -> {
            HttpURLConnection connection = null;

            try {
                URL url = new URL(apiBaseUrl + path);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(70000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("User-Agent", "DiagnoseHUB-Android/" + BuildConfig.VERSION_NAME);

                if (accessToken != null && !accessToken.isEmpty()) {
                    connection.setRequestProperty("Authorization", "Bearer " + accessToken);
                }

                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream outputStream = connection.getOutputStream()) {
                    outputStream.write(payload);
                }

                int statusCode = connection.getResponseCode();
                InputStream responseStream = statusCode >= 400
                        ? connection.getErrorStream()
                        : connection.getInputStream();
                String responseText = readStream(responseStream);
                JSONObject responseJson = responseText.isEmpty()
                        ? new JSONObject()
                        : new JSONObject(responseText);

                mainHandler.post(() -> {
                    if (statusCode >= 200 && statusCode < 300) {
                        callback.onSuccess(responseJson);
                    } else {
                        callback.onError(responseJson.optString("error", "HTTP " + statusCode));
                    }
                });
            } catch (Exception error) {
                mainHandler.post(() -> callback.onError(
                        error.getMessage() == null
                                ? "Netzwerkfehler."
                                : error.getMessage()
                ));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append('\n');
            }
        }

        return builder.toString().trim();
    }

    private void renderDiagnosisHistory() {
        if (diagnosisOutput == null) {
            return;
        }

        if (diagnosisMessages.isEmpty()) {
            setOutput(
                    diagnosisOutput,
                    "Noch keine Diagnose gestartet.\n\nTipp: Kombiniere Fehlercode und Symptom, z. B. P0299 + Leistungsverlust + Fahrzeugdaten.",
                    false
            );
            return;
        }

        StringBuilder builder = new StringBuilder();
        for (ChatMessage message : diagnosisMessages) {
            String author = "assistant".equals(message.role)
                    ? "DiagnoseHUB"
                    : ("hobby".equals(message.audienceMode) ? "Hobby" : "Werkstatt");
            builder.append(author).append(":\n")
                    .append(message.content.trim())
                    .append("\n\n");
        }

        setOutput(diagnosisOutput, builder.toString().trim(), false);
    }

    private JSONArray toMessageArray() throws Exception {
        JSONArray array = new JSONArray();
        for (ChatMessage message : diagnosisMessages) {
            JSONObject object = new JSONObject();
            object.put("role", message.role);
            object.put("content", message.content);
            object.put("audienceMode", message.audienceMode);
            array.put(object);
        }
        return array;
    }

    private String formatGuide(JSONObject guide) {
        StringBuilder builder = new StringBuilder();
        appendBlock(builder, guide.optString("title", "Anleitung"), guide.optString("subtitle", ""));
        appendLine(builder, "Schwierigkeit", guide.optString("difficulty", "nicht angegeben"));
        appendLine(builder, "Zeit", guide.optString("estimatedTime", "nicht angegeben"));
        appendLine(builder, "Fahrzeugbezug", guide.optString("vehicleApplicability", "nicht angegeben"));
        appendArray(builder, "Werkzeug", guide.optJSONArray("tools"));
        appendArray(builder, "Sicherheit", guide.optJSONArray("safetyNotes"));
        appendArray(builder, "Erste Prüfungen", guide.optJSONArray("initialChecks"));
        appendSteps(builder, guide.optJSONArray("steps"));
        appendArray(builder, "Ursachen / typische Fehler", guide.optJSONArray("commonCauses"));
        appendArray(builder, "Nächste Schritte", guide.optJSONArray("nextActions"));
        return builder.toString().trim();
    }

    private void appendSteps(StringBuilder builder, JSONArray steps) {
        if (steps == null || steps.length() == 0) {
            return;
        }

        builder.append("\nSchritte\n");
        for (int index = 0; index < steps.length(); index++) {
            JSONObject step = steps.optJSONObject(index);
            if (step == null) {
                continue;
            }

            builder.append(index + 1)
                    .append(". ")
                    .append(step.optString("title", "Schritt"))
                    .append('\n');
            appendOptionalIndented(builder, step.optString("description", ""));
            appendOptionalIndented(builder, step.optString("check", ""));
            appendOptionalIndented(builder, step.optString("measurement", ""));
            appendOptionalIndented(builder, step.optString("expectedResult", ""));
            appendOptionalIndented(builder, step.optString("decision", ""));
            appendOptionalIndented(builder, step.optString("warning", ""));
            builder.append('\n');
        }
    }

    private void appendBlock(StringBuilder builder, String title, String body) {
        builder.append(title).append('\n');
        if (body != null && !body.trim().isEmpty()) {
            builder.append(body.trim()).append("\n\n");
        }
    }

    private void appendLine(StringBuilder builder, String label, String value) {
        if (value == null || value.trim().isEmpty()) {
            return;
        }
        builder.append(label).append(": ").append(value.trim()).append('\n');
    }

    private void appendArray(StringBuilder builder, String label, JSONArray array) {
        if (array == null || array.length() == 0) {
            return;
        }

        builder.append("\n").append(label).append('\n');
        for (int index = 0; index < array.length(); index++) {
            String value = array.optString(index, "").trim();
            if (!value.isEmpty()) {
                builder.append("• ").append(value).append('\n');
            }
        }
    }

    private void appendOptionalIndented(StringBuilder builder, String value) {
        if (value != null && !value.trim().isEmpty()) {
            builder.append("   ").append(value.trim()).append('\n');
        }
    }

    private String appendQuality(String result, String quality) {
        if (quality == null || quality.isEmpty()) {
            return result;
        }

        return result + "\n\nPrüfung: " + quality;
    }

    private Session sessionFromJson(JSONObject response) throws Exception {
        String accessToken = response.optString("accessToken", "");
        String refreshToken = response.optString("refreshToken", "");
        long expiresAt = response.optLong("expiresAt", 0L);
        long expiresIn = response.optLong("expiresIn", 0L);
        JSONObject user = response.optJSONObject("user");
        String email = user == null ? "" : user.optString("email", "");

        if (accessToken.isEmpty() || refreshToken.isEmpty()) {
            throw new Exception("Anmeldung ohne vollständige Session.");
        }

        if (expiresAt <= 0L && expiresIn > 0L) {
            expiresAt = (System.currentTimeMillis() / 1000L) + expiresIn;
        }

        return new Session(accessToken, refreshToken, email, expiresAt);
    }

    private Session loadSession() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String accessToken = prefs.getString(KEY_ACCESS_TOKEN, "");
        String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, "");
        String email = prefs.getString(KEY_EMAIL, "");
        long expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L);

        if (accessToken == null || accessToken.isEmpty()) {
            return null;
        }

        return new Session(accessToken, refreshToken == null ? "" : refreshToken, email == null ? "" : email, expiresAt);
    }

    private void saveSession(Session sessionToSave) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(KEY_ACCESS_TOKEN, sessionToSave.accessToken)
                .putString(KEY_REFRESH_TOKEN, sessionToSave.refreshToken)
                .putString(KEY_EMAIL, sessionToSave.email)
                .putLong(KEY_EXPIRES_AT, sessionToSave.expiresAtSeconds)
                .apply();
    }

    private void clearSession() {
        session = null;
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().clear().apply();
    }

    private void refreshAccountStatus() {
        if (accountStatus == null) {
            return;
        }

        if (session == null) {
            accountStatus.setText("Nicht angemeldet · Diagnose und Lernen benötigen ein Konto");
            accountStatus.setTextColor(COLOR_WARNING);
        } else {
            accountStatus.setText("Angemeldet · " + safe(session.email));
            accountStatus.setTextColor(COLOR_GREEN);
        }
    }

    private void refreshTabs() {
        if (diagnoseTabButton == null) {
            return;
        }
        styleTab(diagnoseTabButton, "diagnose".equals(currentTab));
        styleTab(guideTabButton, "guide".equals(currentTab));
        styleTab(learningTabButton, "learning".equals(currentTab));
        styleTab(accountTabButton, "account".equals(currentTab));
    }

    private void refreshModeButtons() {
        if (workshopModeButton == null) {
            return;
        }
        stylePill(workshopModeButton, "workshop".equals(audienceMode));
        stylePill(hobbyModeButton, "hobby".equals(audienceMode));
    }

    private TextView text(String value, int sizeSp, int color, int style) {
        TextView textView = new TextView(this);
        textView.setText(value);
        textView.setTextColor(color);
        textView.setTextSize(sizeSp);
        textView.setTypeface(Typeface.DEFAULT, style);
        textView.setLineSpacing(0, 1.08f);
        return textView;
    }

    private TextView paragraph(String value) {
        TextView paragraph = text(value, 14, COLOR_MUTED, Typeface.NORMAL);
        paragraph.setPadding(0, dp(8), 0, dp(12));
        return paragraph;
    }

    private TextView label(String value) {
        TextView label = text(value, 13, COLOR_MUTED, Typeface.BOLD);
        label.setPadding(0, dp(10), 0, dp(6));
        return label;
    }

    private EditText editText(String hint, int minLines) {
        EditText editText = new EditText(this);
        editText.setHint(hint);
        editText.setHintTextColor(Color.rgb(148, 163, 184));
        editText.setTextColor(COLOR_TEXT);
        editText.setTextSize(15);
        editText.setMinLines(minLines);
        editText.setGravity(Gravity.TOP | Gravity.START);
        editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        editText.setPadding(dp(14), dp(12), dp(14), dp(12));
        editText.setBackground(rounded(COLOR_BACKGROUND, COLOR_BORDER, 14));
        editText.setSingleLine(false);
        editText.setLayoutParams(blockParams());
        return editText;
    }

    private TextView outputBox() {
        TextView output = text("", 14, COLOR_TEXT, Typeface.NORMAL);
        output.setTextIsSelectable(true);
        output.setPadding(dp(14), dp(14), dp(14), dp(14));
        output.setBackground(rounded(Color.rgb(8, 13, 28), COLOR_BORDER, 14));
        LinearLayout.LayoutParams params = blockParams();
        params.topMargin = dp(14);
        output.setLayoutParams(params);
        return output;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackground(rounded(COLOR_SURFACE, COLOR_BORDER, 18));
        LinearLayout.LayoutParams params = blockParams();
        params.bottomMargin = dp(12);
        card.setLayoutParams(params);
        return card;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(8), 0, 0);
        return row;
    }

    private Button actionButton(String label, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setPadding(dp(10), dp(10), dp(10), dp(10));
        button.setBackground(rounded(color, color, 14));
        LinearLayout.LayoutParams params = blockParams();
        params.topMargin = dp(12);
        button.setLayoutParams(params);
        return button;
    }

    private Button outlineButton(String label) {
        Button button = actionButton(label, COLOR_SURFACE_LIGHT);
        button.setTextColor(COLOR_TEXT);
        button.setBackground(rounded(COLOR_SURFACE_LIGHT, COLOR_BORDER, 14));
        return button;
    }

    private Button pillButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setPadding(dp(8), dp(8), dp(8), dp(8));
        stylePill(button, false);
        return button;
    }

    private Button quickTopicButton(String label, EditText target) {
        Button button = outlineButton(label);
        button.setTextSize(12);
        button.setOnClickListener(view -> target.setText(topicForLabel(label)));
        return button;
    }

    private String topicForLabel(String label) {
        if (label.toLowerCase(Locale.GERMANY).contains("ntc")) {
            return "Erkläre einen NTC-Sensor: Aufgabe, Kennlinie, typische Messwerte, Fehlerbilder und Prüfung.";
        }
        if (label.toLowerCase(Locale.GERMANY).contains("wechsler")) {
            return "Welche Klemmen hat ein Wechslerrelais und wie arbeitet es im Fahrzeug?";
        }
        if (label.toLowerCase(Locale.GERMANY).contains("drehstrom")) {
            return "Wie funktioniert konkret ein Drehstromgenerator im Fahrzeug?";
        }
        return "Halogenhauptscheinwerfer 12 V: Aufbau, Sollwerte, Spannungsfallprüfung und typische Fehler.";
    }

    private TextView disclaimer() {
        TextView disclaimer = text(
                "Hinweis: Werte und Anleitungen immer am konkreten Fahrzeug prüfen. DiagnoseHUB übernimmt keine Verantwortung für die Richtigkeit der gelieferten Daten.",
                12,
                Color.rgb(148, 163, 184),
                Typeface.NORMAL
        );
        disclaimer.setPadding(dp(4), dp(4), dp(4), dp(12));
        return disclaimer;
    }

    private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private LinearLayout.LayoutParams blockParams() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams weightParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        params.setMargins(dp(3), 0, dp(3), 0);
        return params;
    }

    private void stylePill(Button button, boolean selected) {
        button.setTextColor(selected ? Color.WHITE : COLOR_MUTED);
        button.setBackground(rounded(selected ? COLOR_BLUE : COLOR_SURFACE_LIGHT, selected ? COLOR_BLUE : COLOR_BORDER, 14));
    }

    private void styleTab(Button button, boolean selected) {
        button.setTextColor(selected ? Color.WHITE : COLOR_MUTED);
        button.setBackground(rounded(selected ? COLOR_BLUE : COLOR_SURFACE, selected ? COLOR_BLUE : COLOR_BORDER, 14));
    }

    private void setBusy(Button button, String label) {
        button.setEnabled(false);
        button.setText(label);
        button.setAlpha(0.75f);
    }

    private void restoreButton(Button button, String label) {
        button.setEnabled(true);
        button.setText(label);
        button.setAlpha(1f);
    }

    private void setOutput(TextView output, String value, boolean error) {
        if (output == null) {
            return;
        }
        output.setText(value);
        output.setTextColor(error ? COLOR_DANGER : COLOR_TEXT);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void openWeb(String path) {
        Uri uri = Uri.parse(apiBaseUrl + path);
        startActivity(new Intent(Intent.ACTION_VIEW, uri));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String safe(String value) {
        return value == null || value.trim().isEmpty() ? "Konto" : value.trim();
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "https://diagnosehub.de";
        }

        String normalized = value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private interface JsonCallback {
        void onSuccess(JSONObject response);

        void onError(String message);
    }

    private interface SessionConsumer {
        void onReady(Session session);
    }

    private interface ErrorCallback {
        void onError(String message);
    }

    private static class Session {
        final String accessToken;
        final String refreshToken;
        final String email;
        final long expiresAtSeconds;

        Session(String accessToken, String refreshToken, String email, long expiresAtSeconds) {
            this.accessToken = accessToken == null ? "" : accessToken;
            this.refreshToken = refreshToken == null ? "" : refreshToken;
            this.email = email == null ? "" : email;
            this.expiresAtSeconds = expiresAtSeconds;
        }
    }

    private static class ChatMessage {
        final String role;
        final String content;
        final String audienceMode;

        ChatMessage(String role, String content, String audienceMode) {
            this.role = role;
            this.content = content;
            this.audienceMode = audienceMode;
        }
    }
}
