import Security
import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = DiagnoseHubViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

private final class DiagnoseHubViewController: UIViewController {
    private enum Tab {
        case diagnose
        case guide
        case learning
        case account
    }

    private struct Session {
        let accessToken: String
        let refreshToken: String
        let email: String
        let expiresAt: TimeInterval
    }

    private struct ChatMessage {
        let role: String
        let content: String
        let audienceMode: String
    }

    private let apiBaseURL = URL(string: "https://diagnosehub.de")!
    private let backgroundColor = UIColor(red: 2 / 255, green: 6 / 255, blue: 23 / 255, alpha: 1)
    private let surfaceColor = UIColor(red: 15 / 255, green: 23 / 255, blue: 42 / 255, alpha: 1)
    private let surfaceLightColor = UIColor(red: 30 / 255, green: 41 / 255, blue: 59 / 255, alpha: 1)
    private let borderColor = UIColor(red: 51 / 255, green: 65 / 255, blue: 85 / 255, alpha: 1)
    private let textColor = UIColor(red: 248 / 255, green: 250 / 255, blue: 252 / 255, alpha: 1)
    private let mutedColor = UIColor(red: 203 / 255, green: 213 / 255, blue: 225 / 255, alpha: 1)
    private let blueColor = UIColor(red: 37 / 255, green: 99 / 255, blue: 235 / 255, alpha: 1)
    private let greenColor = UIColor(red: 22 / 255, green: 163 / 255, blue: 74 / 255, alpha: 1)
    private let warningColor = UIColor(red: 250 / 255, green: 204 / 255, blue: 21 / 255, alpha: 1)
    private let dangerColor = UIColor(red: 248 / 255, green: 113 / 255, blue: 113 / 255, alpha: 1)

    private let scrollView = UIScrollView()
    private let rootStack = UIStackView()
    private let contentStack = UIStackView()
    private let accountStatusLabel = UILabel()

    private var diagnoseTabButton = UIButton(type: .system)
    private var guideTabButton = UIButton(type: .system)
    private var learningTabButton = UIButton(type: .system)
    private var accountTabButton = UIButton(type: .system)
    private var workshopModeButton = UIButton(type: .system)
    private var hobbyModeButton = UIButton(type: .system)

    private var diagnosisOutput: UITextView?
    private var guideOutput: UITextView?
    private var learningOutput: UITextView?

    private var session: Session?
    private var currentTab: Tab = .diagnose
    private var audienceMode = "workshop"
    private var diagnosisMessages: [ChatMessage] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = backgroundColor
        session = loadSession()
        buildShell()
        showDiagnoseScreen()
    }

    private func buildShell() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        rootStack.axis = .vertical
        rootStack.spacing = 14
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(rootStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            rootStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 18),
            rootStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 18),
            rootStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -18),
            rootStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])

        rootStack.addArrangedSubview(label("DiagnoseHUB Beta 0.9", size: 13, color: mutedColor, weight: .bold))
        rootStack.addArrangedSubview(label("Native Diagnose", size: 34, color: textColor, weight: .bold))
        rootStack.addArrangedSubview(label(
            "Diagnose, Anleitung und Lernwissen als iOS-App. Die Antworten werden genauer, je mehr Fahrzeugdaten du eingibst.",
            size: 15,
            color: mutedColor,
            weight: .regular
        ))

        accountStatusLabel.font = .systemFont(ofSize: 13, weight: .bold)
        accountStatusLabel.numberOfLines = 0
        rootStack.addArrangedSubview(accountStatusLabel)
        refreshAccountStatus()

        rootStack.addArrangedSubview(buildModeCard())
        rootStack.addArrangedSubview(buildTabRow())

        contentStack.axis = .vertical
        contentStack.spacing = 12
        rootStack.addArrangedSubview(contentStack)
    }

    private func buildModeCard() -> UIView {
        let card = cardStack()
        card.addArrangedSubview(label("Ausgabemodus", size: 13, color: mutedColor, weight: .bold))

        let row = horizontalStack()
        workshopModeButton = button("Werkstatt")
        hobbyModeButton = button("Hobby")

        workshopModeButton.addAction(UIAction { [weak self] _ in
            self?.audienceMode = "workshop"
            self?.refreshModeButtons()
        }, for: .touchUpInside)

        hobbyModeButton.addAction(UIAction { [weak self] _ in
            self?.audienceMode = "hobby"
            self?.refreshModeButtons()
        }, for: .touchUpInside)

        row.addArrangedSubview(workshopModeButton)
        row.addArrangedSubview(hobbyModeButton)
        card.addArrangedSubview(row)
        card.addArrangedSubview(label(
            "Hobby: normale Sprache, Risiko, Werkzeug. Werkstatt: Messwerte, Prüfpfad, Entscheidung.",
            size: 13,
            color: mutedColor,
            weight: .regular
        ))

        refreshModeButtons()
        return card
    }

    private func buildTabRow() -> UIView {
        let row = horizontalStack()
        diagnoseTabButton = tabButton("Diagnose", tab: .diagnose)
        guideTabButton = tabButton("Anleitung", tab: .guide)
        learningTabButton = tabButton("Lernen", tab: .learning)
        accountTabButton = tabButton("Konto", tab: .account)
        row.addArrangedSubview(diagnoseTabButton)
        row.addArrangedSubview(guideTabButton)
        row.addArrangedSubview(learningTabButton)
        row.addArrangedSubview(accountTabButton)
        refreshTabs()
        return row
    }

    private func tabButton(_ title: String, tab: Tab) -> UIButton {
        let tabButton = button(title)
        tabButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        tabButton.addAction(UIAction { [weak self] _ in
            switch tab {
            case .diagnose:
                self?.showDiagnoseScreen()
            case .guide:
                self?.showGuideScreen()
            case .learning:
                self?.showLearningScreen()
            case .account:
                self?.showAccountScreen()
            }
        }, for: .touchUpInside)
        return tabButton
    }

    private func showDiagnoseScreen() {
        currentTab = .diagnose
        refreshTabs()
        clearContent()

        let card = cardStack()
        card.addArrangedSubview(label("Diagnose", size: 22, color: textColor, weight: .bold))
        card.addArrangedSubview(paragraph("Ein Feld reicht: Fehlercode, Symptom, Messwert oder Anleitungshinweis eingeben. Fahrzeugdaten machen die Antwort deutlich präziser."))

        let vehicleInput = input("Fahrzeugdaten: Marke, Modell, Baujahr, Motorcode, Kilometerstand", minHeight: 86)
        let diagnosisInput = input("Beispiel: VW Passat 2.0 TDI, P0299, Leistungsverlust ab 2500 U/min, Ladedruck Ist 1400 mbar", minHeight: 132)

        card.addArrangedSubview(formLabel("Fahrzeugdaten"))
        card.addArrangedSubview(vehicleInput)
        card.addArrangedSubview(formLabel("Fehlercode, Symptom oder Frage"))
        card.addArrangedSubview(diagnosisInput)

        let row = horizontalStack()
        let sendButton = primaryButton("Diagnose starten")
        let clearButton = secondaryButton("Verlauf löschen")
        row.addArrangedSubview(sendButton)
        row.addArrangedSubview(clearButton)
        card.addArrangedSubview(row)

        let output = outputBox()
        diagnosisOutput = output
        card.addArrangedSubview(output)
        renderDiagnosisHistory()

        sendButton.addAction(UIAction { [weak self, weak vehicleInput, weak diagnosisInput, weak sendButton] _ in
            guard let self, let vehicleInput, let diagnosisInput, let sendButton else { return }
            self.sendDiagnosis(vehicleInput: vehicleInput, diagnosisInput: diagnosisInput, button: sendButton)
        }, for: .touchUpInside)

        clearButton.addAction(UIAction { [weak self] _ in
            self?.diagnosisMessages.removeAll()
            self?.renderDiagnosisHistory()
        }, for: .touchUpInside)

        contentStack.addArrangedSubview(card)
        contentStack.addArrangedSubview(disclaimer())
    }

    private func showGuideScreen() {
        currentTab = .guide
        refreshTabs()
        clearContent()

        let card = cardStack()
        card.addArrangedSubview(label("Anleitung", size: 22, color: textColor, weight: .bold))
        card.addArrangedSubview(paragraph("Native Anleitungssuche mit Werkzeugliste, Schwierigkeit, Prüfschritten und Sicherheitsgrenzen."))

        let guideInput = input("Beispiel: Qashqai Gebläsemotor ausbauen oder Golf 7 AGR-Ventil prüfen", minHeight: 112)
        card.addArrangedSubview(formLabel("Bauteil, Arbeit oder Diagnoseziel"))
        card.addArrangedSubview(guideInput)

        let generateButton = primaryButton("Anleitung erstellen")
        card.addArrangedSubview(generateButton)

        let output = outputBox()
        output.text = "Noch keine Anleitung geladen."
        guideOutput = output
        card.addArrangedSubview(output)

        generateButton.addAction(UIAction { [weak self, weak guideInput, weak generateButton] _ in
            guard let self, let guideInput, let generateButton else { return }
            self.sendGuideRequest(queryInput: guideInput, button: generateButton)
        }, for: .touchUpInside)

        contentStack.addArrangedSubview(card)
        contentStack.addArrangedSubview(disclaimer())
    }

    private func showLearningScreen() {
        currentTab = .learning
        refreshTabs()
        clearContent()

        let card = cardStack()
        card.addArrangedSubview(label("Lernen", size: 22, color: textColor, weight: .bold))
        card.addArrangedSubview(paragraph("Bauteilwissen für Ausbildung und Werkstatt: Aufgaben, Klemmen, Messwerte, Zusammenspiel und typische Fehler."))

        let learningInput = input("Beispiel: Erkläre einen NTC oder welche Klemmen hat ein Wechslerrelais?", minHeight: 112)
        card.addArrangedSubview(formLabel("Lernthema"))
        card.addArrangedSubview(learningInput)

        let quickOne = horizontalStack()
        quickOne.addArrangedSubview(quickTopicButton("NTC erklären", target: learningInput))
        quickOne.addArrangedSubview(quickTopicButton("Wechslerrelais", target: learningInput))
        card.addArrangedSubview(quickOne)

        let quickTwo = horizontalStack()
        quickTwo.addArrangedSubview(quickTopicButton("Drehstromgenerator", target: learningInput))
        quickTwo.addArrangedSubview(quickTopicButton("Halogen 12 V", target: learningInput))
        card.addArrangedSubview(quickTwo)

        let learnButton = primaryButton("Wissen laden")
        card.addArrangedSubview(learnButton)

        let output = outputBox()
        output.text = "Noch kein Lerninhalt geladen."
        learningOutput = output
        card.addArrangedSubview(output)

        learnButton.addAction(UIAction { [weak self, weak learningInput, weak learnButton] _ in
            guard let self, let learningInput, let learnButton else { return }
            self.sendLearningRequest(queryInput: learningInput, button: learnButton)
        }, for: .touchUpInside)

        contentStack.addArrangedSubview(card)
        contentStack.addArrangedSubview(disclaimer())
    }

    private func showAccountScreen() {
        currentTab = .account
        refreshTabs()
        clearContent()

        let card = cardStack()
        card.addArrangedSubview(label("Konto", size: 22, color: textColor, weight: .bold))

        if let session {
            card.addArrangedSubview(paragraph("Angemeldet als \(session.email.isEmpty ? "Konto" : session.email)."))
            let dashboardButton = primaryButton("Profil und Tarif öffnen")
            let logoutButton = secondaryButton("Abmelden")
            card.addArrangedSubview(dashboardButton)
            card.addArrangedSubview(logoutButton)

            dashboardButton.addAction(UIAction { [weak self] _ in
                self?.openWeb(path: "/dashboard")
            }, for: .touchUpInside)

            logoutButton.addAction(UIAction { [weak self] _ in
                self?.clearSession()
                self?.diagnosisMessages.removeAll()
                self?.refreshAccountStatus()
                self?.showAccountScreen()
            }, for: .touchUpInside)
        } else {
            card.addArrangedSubview(paragraph("Melde dich mit deinem DiagnoseHUB-Konto an. Neue Konten richtest du im Browser ein."))

            let emailInput = textField("E-Mail")
            emailInput.keyboardType = .emailAddress
            emailInput.textContentType = .username
            emailInput.autocapitalizationType = .none
            emailInput.autocorrectionType = .no

            let passwordInput = textField("Passwort")
            passwordInput.isSecureTextEntry = true
            passwordInput.textContentType = .password

            card.addArrangedSubview(formLabel("E-Mail"))
            card.addArrangedSubview(emailInput)
            card.addArrangedSubview(formLabel("Passwort"))
            card.addArrangedSubview(passwordInput)

            let loginButton = primaryButton("Anmelden")
            let createButton = secondaryButton("Account einrichten")
            card.addArrangedSubview(loginButton)
            card.addArrangedSubview(createButton)

            loginButton.addAction(UIAction { [weak self, weak emailInput, weak passwordInput, weak loginButton] _ in
                guard let self, let emailInput, let passwordInput, let loginButton else { return }
                self.login(email: emailInput.text ?? "", password: passwordInput.text ?? "", button: loginButton)
            }, for: .touchUpInside)

            createButton.addAction(UIAction { [weak self] _ in
                self?.openWeb(path: "/login")
            }, for: .touchUpInside)
        }

        contentStack.addArrangedSubview(card)
        contentStack.addArrangedSubview(disclaimer())
    }

    private func sendDiagnosis(vehicleInput: UITextView, diagnosisInput: UITextView, button: UIButton) {
        let vehicle = vehicleInput.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let diagnosis = diagnosisInput.text.trimmingCharacters(in: .whitespacesAndNewlines)

        guard diagnosis.count >= 2 else {
            showToast("Bitte Fehlercode, Symptom oder Frage eingeben.")
            return
        }

        let inputText = """
        Fahrzeugdaten:
        \(vehicle.isEmpty ? "Nicht angegeben" : vehicle)

        Diagnose / Fehlercode / Frage:
        \(diagnosis)

        Ausgabemodus:
        \(audienceMode == "hobby" ? "Hobby-Modus" : "Werkstatt-Modus")
        """

        setBusy(button, title: "Diagnose läuft...")
        withFreshSession { [weak self, weak diagnosisInput, weak button] activeSession in
            guard let self, let diagnosisInput, let button else { return }
            let body: [String: Any] = [
                "input": inputText,
                "messages": self.diagnosisMessages.map { message in
                    [
                        "role": message.role,
                        "content": message.content,
                        "audienceMode": message.audienceMode
                    ]
                },
                "audienceMode": self.audienceMode,
                "accessToken": activeSession.accessToken
            ]

            self.postJSON(path: "/api/diagnose", body: body, accessToken: activeSession.accessToken) { result in
                self.restore(button, title: "Diagnose starten")
                switch result {
                case .success(let response):
                    var answer = (response["result"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    let quality = (response["qualityCheck"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    if answer.isEmpty {
                        answer = "Die Diagnose hat keine auslesbare Antwort geliefert."
                    }
                    if !quality.isEmpty {
                        answer += "\n\nPrüfung: \(quality)"
                    }
                    self.diagnosisMessages.append(ChatMessage(role: "user", content: inputText, audienceMode: self.audienceMode))
                    self.diagnosisMessages.append(ChatMessage(role: "assistant", content: answer, audienceMode: self.audienceMode))
                    diagnosisInput.text = ""
                    self.renderDiagnosisHistory()
                case .failure(let message):
                    self.setOutput(self.diagnosisOutput, text: "Fehler: \(message)", isError: true)
                }
            }
        } onError: { [weak self, weak button] message in
            guard let self, let button else { return }
            self.restore(button, title: "Diagnose starten")
            self.setOutput(self.diagnosisOutput, text: message, isError: true)
        }
    }

    private func sendGuideRequest(queryInput: UITextView, button: UIButton) {
        let query = queryInput.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else {
            showToast("Bitte Thema oder Arbeit eingeben.")
            return
        }

        setBusy(button, title: "Anleitung läuft...")
        withFreshSession { [weak self, weak button] activeSession in
            guard let self, let button else { return }
            self.postJSON(
                path: "/api/anleitungen/generate",
                body: ["query": query, "source": "search"],
                accessToken: activeSession.accessToken
            ) { result in
                self.restore(button, title: "Anleitung erstellen")
                switch result {
                case .success(let response):
                    if let guide = response["guide"] as? [String: Any] {
                        self.setOutput(self.guideOutput, text: self.formatGuide(guide), isError: false)
                    } else {
                        self.setOutput(self.guideOutput, text: "Die Anleitung konnte nicht gelesen werden.", isError: true)
                    }
                case .failure(let message):
                    self.setOutput(self.guideOutput, text: "Fehler: \(message)", isError: true)
                }
            }
        } onError: { [weak self, weak button] message in
            guard let self, let button else { return }
            self.restore(button, title: "Anleitung erstellen")
            self.setOutput(self.guideOutput, text: message, isError: true)
        }
    }

    private func sendLearningRequest(queryInput: UITextView, button: UIButton) {
        let query = queryInput.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else {
            showToast("Bitte Lernthema eingeben.")
            return
        }

        setBusy(button, title: "Wissen wird geladen...")
        withFreshSession { [weak self, weak button] activeSession in
            guard let self, let button else { return }
            self.postJSON(path: "/api/lernen/wissen", body: ["query": query], accessToken: activeSession.accessToken) { result in
                self.restore(button, title: "Wissen laden")
                switch result {
                case .success(let response):
                    let answer = (response["answer"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
                    self.setOutput(self.learningOutput, text: answer?.isEmpty == false ? answer! : "Es wurde kein Lerninhalt geliefert.", isError: false)
                case .failure(let message):
                    self.setOutput(self.learningOutput, text: "Fehler: \(message)", isError: true)
                }
            }
        } onError: { [weak self, weak button] message in
            guard let self, let button else { return }
            self.restore(button, title: "Wissen laden")
            self.setOutput(self.learningOutput, text: message, isError: true)
        }
    }

    private func login(email: String, password: String, button: UIButton) {
        let cleanedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !cleanedEmail.isEmpty, !password.isEmpty else {
            showToast("Bitte E-Mail und Passwort eingeben.")
            return
        }

        setBusy(button, title: "Anmeldung...")
        postJSON(path: "/api/mobile/auth/login", body: ["email": cleanedEmail, "password": password]) { [weak self, weak button] result in
            guard let self, let button else { return }
            self.restore(button, title: "Anmelden")
            switch result {
            case .success(let response):
                guard let session = self.session(from: response) else {
                    self.showToast("Anmeldung ohne vollständige Session.")
                    return
                }
                self.save(session: session)
                self.session = session
                self.refreshAccountStatus()
                self.showToast("Angemeldet.")
                self.showDiagnoseScreen()
            case .failure(let message):
                self.showToast(message)
            }
        }
    }

    private func withFreshSession(_ onReady: @escaping (Session) -> Void, onError: @escaping (String) -> Void) {
        guard let session else {
            onError("Bitte zuerst im Konto-Tab anmelden.")
            return
        }

        let now = Date().timeIntervalSince1970
        if session.expiresAt > now + 120 || session.refreshToken.isEmpty {
            onReady(session)
            return
        }

        postJSON(path: "/api/mobile/auth/refresh", body: ["refreshToken": session.refreshToken]) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let response):
                guard let refreshedSession = self.session(from: response) else {
                    self.clearSession()
                    onError("Bitte erneut anmelden.")
                    return
                }
                self.save(session: refreshedSession)
                self.session = refreshedSession
                self.refreshAccountStatus()
                onReady(refreshedSession)
            case .failure:
                self.clearSession()
                self.refreshAccountStatus()
                onError("Session abgelaufen. Bitte erneut anmelden.")
            }
        }
    }

    private func postJSON(
        path: String,
        body: [String: Any],
        accessToken: String? = nil,
        completion: @escaping (Result<[String: Any], String>) -> Void
    ) {
        let url = endpointURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 70
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("DiagnoseHUB-iOS/0.9.0", forHTTPHeaderField: "User-Agent")
        if let accessToken, !accessToken.isEmpty {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            completion(.failure("Request konnte nicht erstellt werden."))
            return
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            let parsedResult: Result<[String: Any], String>

            if let error {
                parsedResult = .failure(error.localizedDescription)
            } else {
                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                let payload = data ?? Data()
                let jsonObject = (try? JSONSerialization.jsonObject(with: payload, options: [])) as? [String: Any]
                let dictionary = jsonObject ?? [:]

                if (200..<300).contains(statusCode) {
                    parsedResult = .success(dictionary)
                } else {
                    parsedResult = .failure(dictionary["error"] as? String ?? "HTTP \(statusCode)")
                }
            }

            DispatchQueue.main.async {
                completion(parsedResult)
            }
        }.resume()
    }

    private func renderDiagnosisHistory() {
        guard let diagnosisOutput else { return }

        if diagnosisMessages.isEmpty {
            setOutput(
                diagnosisOutput,
                text: "Noch keine Diagnose gestartet.\n\nTipp: Kombiniere Fehlercode und Symptom, z. B. P0299 + Leistungsverlust + Fahrzeugdaten.",
                isError: false
            )
            return
        }

        let text = diagnosisMessages.map { message in
            let author = message.role == "assistant" ? "DiagnoseHUB" : (message.audienceMode == "hobby" ? "Hobby" : "Werkstatt")
            return "\(author):\n\(message.content)"
        }.joined(separator: "\n\n")

        setOutput(diagnosisOutput, text: text, isError: false)
    }

    private func formatGuide(_ guide: [String: Any]) -> String {
        var lines: [String] = []
        lines.append(guide["title"] as? String ?? "Anleitung")
        if let subtitle = guide["subtitle"] as? String, !subtitle.isEmpty {
            lines.append(subtitle)
        }
        appendLine(&lines, "Schwierigkeit", guide["difficulty"] as? String)
        appendLine(&lines, "Zeit", guide["estimatedTime"] as? String)
        appendLine(&lines, "Fahrzeugbezug", guide["vehicleApplicability"] as? String)
        appendArray(&lines, "Werkzeug", guide["tools"])
        appendArray(&lines, "Sicherheit", guide["safetyNotes"])
        appendArray(&lines, "Erste Prüfungen", guide["initialChecks"])
        appendSteps(&lines, guide["steps"])
        appendArray(&lines, "Ursachen / typische Fehler", guide["commonCauses"])
        appendArray(&lines, "Nächste Schritte", guide["nextActions"])
        return lines.joined(separator: "\n")
    }

    private func appendLine(_ lines: inout [String], _ title: String, _ value: String?) {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        lines.append("\(title): \(value)")
    }

    private func appendArray(_ lines: inout [String], _ title: String, _ rawValue: Any?) {
        let values = stringArray(rawValue)
        guard !values.isEmpty else { return }
        lines.append("\n\(title)")
        values.forEach { lines.append("• \($0)") }
    }

    private func appendSteps(_ lines: inout [String], _ rawValue: Any?) {
        guard let steps = rawValue as? [[String: Any]], !steps.isEmpty else { return }
        lines.append("\nSchritte")
        for (index, step) in steps.enumerated() {
            lines.append("\(index + 1). \(step["title"] as? String ?? "Schritt")")
            ["description", "check", "measurement", "expectedResult", "decision", "warning"].forEach { key in
                if let value = step[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    lines.append("   \(value)")
                }
            }
        }
    }

    private func stringArray(_ rawValue: Any?) -> [String] {
        if let values = rawValue as? [String] {
            return values.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        }

        if let values = rawValue as? [Any] {
            return values.compactMap { $0 as? String }.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        }

        return []
    }

    private func session(from response: [String: Any]) -> Session? {
        guard
            let accessToken = response["accessToken"] as? String,
            let refreshToken = response["refreshToken"] as? String,
            !accessToken.isEmpty,
            !refreshToken.isEmpty
        else {
            return nil
        }

        let user = response["user"] as? [String: Any]
        let email = user?["email"] as? String ?? ""
        let expiresAt = response["expiresAt"] as? TimeInterval
        let expiresIn = response["expiresIn"] as? TimeInterval
        let resolvedExpiresAt = expiresAt ?? Date().timeIntervalSince1970 + (expiresIn ?? 0)

        return Session(
            accessToken: accessToken,
            refreshToken: refreshToken,
            email: email,
            expiresAt: resolvedExpiresAt
        )
    }

    private func loadSession() -> Session? {
        guard
            let accessToken = KeychainStore.read(account: "access_token"),
            let refreshToken = KeychainStore.read(account: "refresh_token"),
            !accessToken.isEmpty
        else {
            return nil
        }

        let defaults = UserDefaults.standard
        let email = defaults.string(forKey: "diagnosehub_email") ?? ""
        let expiresAt = defaults.double(forKey: "diagnosehub_expires_at")
        return Session(accessToken: accessToken, refreshToken: refreshToken, email: email, expiresAt: expiresAt)
    }

    private func save(session: Session) {
        KeychainStore.save(session.accessToken, account: "access_token")
        KeychainStore.save(session.refreshToken, account: "refresh_token")
        UserDefaults.standard.set(session.email, forKey: "diagnosehub_email")
        UserDefaults.standard.set(session.expiresAt, forKey: "diagnosehub_expires_at")
    }

    private func clearSession() {
        session = nil
        KeychainStore.delete(account: "access_token")
        KeychainStore.delete(account: "refresh_token")
        UserDefaults.standard.removeObject(forKey: "diagnosehub_email")
        UserDefaults.standard.removeObject(forKey: "diagnosehub_expires_at")
    }

    private func refreshAccountStatus() {
        if let session {
            accountStatusLabel.text = "Angemeldet · \(session.email.isEmpty ? "Konto" : session.email)"
            accountStatusLabel.textColor = greenColor
        } else {
            accountStatusLabel.text = "Nicht angemeldet · Diagnose und Lernen benötigen ein Konto"
            accountStatusLabel.textColor = warningColor
        }
    }

    private func refreshTabs() {
        styleTab(diagnoseTabButton, selected: currentTab == .diagnose)
        styleTab(guideTabButton, selected: currentTab == .guide)
        styleTab(learningTabButton, selected: currentTab == .learning)
        styleTab(accountTabButton, selected: currentTab == .account)
    }

    private func refreshModeButtons() {
        styleButton(workshopModeButton, selected: audienceMode == "workshop")
        styleButton(hobbyModeButton, selected: audienceMode == "hobby")
    }

    private func clearContent() {
        contentStack.arrangedSubviews.forEach { view in
            contentStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
    }

    private func label(_ text: String, size: CGFloat, color: UIColor, weight: UIFont.Weight) -> UILabel {
        let label = UILabel()
        label.text = text
        label.textColor = color
        label.font = .systemFont(ofSize: size, weight: weight)
        label.numberOfLines = 0
        return label
    }

    private func paragraph(_ text: String) -> UILabel {
        label(text, size: 14, color: mutedColor, weight: .regular)
    }

    private func formLabel(_ text: String) -> UILabel {
        label(text, size: 13, color: mutedColor, weight: .bold)
    }

    private func input(_ placeholder: String, minHeight: CGFloat) -> UITextView {
        let textView = PlaceholderTextView()
        textView.placeholder = placeholder
        textView.textColor = textColor
        textView.font = .systemFont(ofSize: 15)
        textView.backgroundColor = backgroundColor
        textView.layer.cornerRadius = 14
        textView.layer.borderWidth = 1
        textView.layer.borderColor = borderColor.cgColor
        textView.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
        textView.heightAnchor.constraint(greaterThanOrEqualToConstant: minHeight).isActive = true
        return textView
    }

    private func textField(_ placeholder: String) -> UITextField {
        let textField = UITextField()
        textField.placeholder = placeholder
        textField.textColor = textColor
        textField.tintColor = textColor
        textField.backgroundColor = backgroundColor
        textField.layer.cornerRadius = 14
        textField.layer.borderWidth = 1
        textField.layer.borderColor = borderColor.cgColor
        textField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 12, height: 1))
        textField.leftViewMode = .always
        textField.heightAnchor.constraint(equalToConstant: 48).isActive = true
        textField.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)]
        )
        return textField
    }

    private func outputBox() -> UITextView {
        let output = UITextView()
        output.isEditable = false
        output.isSelectable = true
        output.isScrollEnabled = false
        output.textColor = textColor
        output.backgroundColor = UIColor(red: 8 / 255, green: 13 / 255, blue: 28 / 255, alpha: 1)
        output.font = .systemFont(ofSize: 14)
        output.layer.cornerRadius = 14
        output.layer.borderWidth = 1
        output.layer.borderColor = borderColor.cgColor
        output.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
        output.heightAnchor.constraint(greaterThanOrEqualToConstant: 190).isActive = true
        return output
    }

    private func cardStack() -> UIStackView {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.backgroundColor = surfaceColor
        stack.layer.cornerRadius = 18
        stack.layer.borderWidth = 1
        stack.layer.borderColor = borderColor.cgColor
        stack.isLayoutMarginsRelativeArrangement = true
        stack.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
        return stack
    }

    private func horizontalStack() -> UIStackView {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 8
        stack.distribution = .fillEqually
        return stack
    }

    private func button(_ title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        button.layer.cornerRadius = 14
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        styleButton(button, selected: false)
        return button
    }

    private func primaryButton(_ title: String) -> UIButton {
        let button = button(title)
        button.backgroundColor = blueColor
        button.setTitleColor(.white, for: .normal)
        button.layer.borderWidth = 0
        return button
    }

    private func secondaryButton(_ title: String) -> UIButton {
        let button = button(title)
        button.backgroundColor = surfaceLightColor
        button.setTitleColor(textColor, for: .normal)
        button.layer.borderWidth = 1
        button.layer.borderColor = borderColor.cgColor
        return button
    }

    private func quickTopicButton(_ title: String, target: UITextView) -> UIButton {
        let button = secondaryButton(title)
        button.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        button.addAction(UIAction { [weak target] _ in
            target?.text = Self.topic(for: title)
            NotificationCenter.default.post(name: UITextView.textDidChangeNotification, object: target)
        }, for: .touchUpInside)
        return button
    }

    private static func topic(for title: String) -> String {
        let lowercased = title.lowercased()
        if lowercased.contains("ntc") {
            return "Erkläre einen NTC-Sensor: Aufgabe, Kennlinie, typische Messwerte, Fehlerbilder und Prüfung."
        }
        if lowercased.contains("wechsler") {
            return "Welche Klemmen hat ein Wechslerrelais und wie arbeitet es im Fahrzeug?"
        }
        if lowercased.contains("drehstrom") {
            return "Wie funktioniert konkret ein Drehstromgenerator im Fahrzeug?"
        }
        return "Halogenhauptscheinwerfer 12 V: Aufbau, Sollwerte, Spannungsfallprüfung und typische Fehler."
    }

    private func styleButton(_ button: UIButton, selected: Bool) {
        button.backgroundColor = selected ? blueColor : surfaceLightColor
        button.setTitleColor(selected ? .white : mutedColor, for: .normal)
        button.layer.borderWidth = 1
        button.layer.borderColor = (selected ? blueColor : borderColor).cgColor
    }

    private func styleTab(_ button: UIButton, selected: Bool) {
        button.backgroundColor = selected ? blueColor : surfaceColor
        button.setTitleColor(selected ? .white : mutedColor, for: .normal)
        button.layer.borderWidth = 1
        button.layer.borderColor = (selected ? blueColor : borderColor).cgColor
    }

    private func disclaimer() -> UILabel {
        label(
            "Hinweis: Werte und Anleitungen immer am konkreten Fahrzeug prüfen. DiagnoseHUB übernimmt keine Verantwortung für die Richtigkeit der gelieferten Daten.",
            size: 12,
            color: UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1),
            weight: .regular
        )
    }

    private func setBusy(_ button: UIButton, title: String) {
        button.isEnabled = false
        button.alpha = 0.72
        button.setTitle(title, for: .normal)
    }

    private func restore(_ button: UIButton, title: String) {
        button.isEnabled = true
        button.alpha = 1
        button.setTitle(title, for: .normal)
    }

    private func setOutput(_ output: UITextView?, text: String, isError: Bool) {
        output?.text = text
        output?.textColor = isError ? dangerColor : textColor
    }

    private func showToast(_ message: String) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        present(alert, animated: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            alert.dismiss(animated: true)
        }
    }

    private func openWeb(path: String) {
        let url = endpointURL(path: path)
        UIApplication.shared.open(url)
    }

    private func endpointURL(path: String) -> URL {
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: normalizedPath, relativeTo: apiBaseURL)!.absoluteURL
    }
}

private final class PlaceholderTextView: UITextView {
    var placeholder: String = "" {
        didSet {
            placeholderLabel.text = placeholder
        }
    }

    private let placeholderLabel = UILabel()

    override var text: String! {
        didSet {
            updatePlaceholder()
        }
    }

    override var font: UIFont? {
        didSet {
            placeholderLabel.font = font
        }
    }

    override var textContainerInset: UIEdgeInsets {
        didSet {
            setNeedsLayout()
        }
    }

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let leftInset = textContainerInset.left + textContainer.lineFragmentPadding
        let topInset = textContainerInset.top
        placeholderLabel.frame = CGRect(
            x: leftInset,
            y: topInset,
            width: bounds.width - leftInset - textContainerInset.right - textContainer.lineFragmentPadding,
            height: 0
        )
        placeholderLabel.sizeToFit()
    }

    private func commonInit() {
        placeholderLabel.textColor = UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)
        placeholderLabel.numberOfLines = 0
        placeholderLabel.font = font
        addSubview(placeholderLabel)

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(textDidChange),
            name: UITextView.textDidChangeNotification,
            object: self
        )

        updatePlaceholder()
    }

    @objc private func textDidChange() {
        updatePlaceholder()
    }

    private func updatePlaceholder() {
        placeholderLabel.isHidden = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

private enum KeychainStore {
    private static let service = "de.diagnosehub.app.session"

    static func save(_ value: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }
        delete(account: account)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    static func read(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    static func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        SecItemDelete(query as CFDictionary)
    }
}
