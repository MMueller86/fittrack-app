# User Flows

## Flow A – First Login Without Profile

### Trigger

User logs in successfully.

Backend/app checks:

```text
GET /profile/me
```

### Result

No profile exists.

### UX

Show modal/dialog:

```text
Persönliches Profil einrichten?

FitTrack kann dadurch deine Kalorien-
und Makroziele individuell berechnen.

[Profil anlegen]
[Später]
```

### User chooses "Profil anlegen"

Open fullscreen wizard.

### User chooses "Später"

- Close dialog.
- Continue to app.
- Use default targets.
- Show a settings entry where the wizard can be started later.

---

## Flow B – Login With Existing Profile

### Trigger

User logs in successfully.

Backend/app checks profile.

### Result

Profile exists.

### UX

Open app normally.

Targets are loaded from the user's profile/target document.

---

## Flow C – User Starts Wizard From Settings

### Trigger

User opens:

```text
Einstellungen → Profil & Zielwerte
```

### UX

Options:

- Profil anzeigen
- Zielwerte anzeigen
- Profil bearbeiten
- Zielwerte neu berechnen
- Zielwerte manuell anpassen

If no profile exists:

- Show "Profil anlegen"

---

## Flow D – Wizard Completion

### Trigger

User completes all wizard steps.

### Behavior

- Create/update user profile.
- Calculate nutrition targets.
- Persist profile and targets.
- Return to app.
- Home screen immediately uses personalized targets.

---

## Flow E – User Cancels Wizard

### Possible behavior

If the user cancels before final save:

- No profile is persisted.
- Existing profile remains unchanged.
- If no profile existed, default targets remain active.

### Confirmation dialog

```text
Wizard verlassen?

Deine Eingaben wurden noch nicht gespeichert.

[Verwerfen]
[Weiter bearbeiten]
```

---

## Flow F – Profile Exists But Weight Changed

### Future trigger

User's current weight differs significantly from profile weight.

Example threshold:

- >= 3 kg difference
- or >= 5% bodyweight difference

### UX

```text
Dein Gewicht hat sich verändert.

Möchtest du deine Zielwerte neu berechnen?

[Neu berechnen]
[Später]
```

### Important

Never recalculate automatically.

---

## Flow G – Daily Training Toggle

### Trigger

User opens home screen.

### UX

Display simple toggle:

```text
Heute:
[Ruhetag] [Trainingstag]
```

or

```text
☐ Trainingstag
```

### Behavior

Switching the toggle updates:

- calories target
- protein target
- fat target
- carbs target
- fiber target

The selected day type should apply to the current diary day.

---

## Flow H – User Manually Adjusts Targets

### Trigger

User reviews generated targets.

### UX

Button:

```text
Werte anpassen
```

### Editable fields

For rest day and training day:

- Calories
- Protein
- Fat
- Carbs
- Fiber

### Behavior

Manual values override generated values.

Store metadata:

```json
{
  "source": "manualOverride"
}
```
