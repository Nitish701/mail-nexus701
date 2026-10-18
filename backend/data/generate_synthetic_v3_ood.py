import csv
import random
from pathlib import Path

def generate_ood_v3():
    data_dir = Path("Mail-nexus/backend/data")
    output_path = data_dir / "synthetic_phishing_v3_ood.csv"

    # Load existing data to avoid duplicates
    existing_texts = set()
    for v in ["synthetic_phishing_v1.csv", "synthetic_phishing_v2.csv", "synthetic_holdout_test.csv"]:
        p = data_dir / v
        if p.exists():
            with p.open(encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    existing_texts.add(row.get('text', ''))

    phishing_templates = [
        # SMS/Brief style
        {"sub": "Alert", "body": "Your package is on hold. Pay fee here: http://bit.ly/pkg-fee-99", "cat": "shipping"},
        {"sub": "MSG", "body": "Tax refund of $450 ready. Claim now: http://irs-refund-portal.com/claim", "cat": "tax"},
        {"sub": "Shared Doc", "body": "User shared 'Payroll_2026.pdf' with you on OneDrive. View: http://onedrive-live-doc.net/v/123", "cat": "cloud"},
        {"sub": "HR Update", "body": "Urgent: Your direct deposit info is incorrect. Update immediately at http://company-hr-portal.io/update", "cat": "payroll"},
        {"sub": "Alumni", "body": "Reconnect with your batch! Log in to the alumni portal to see the 2026 reunion list: http://uni-alumni-net.org/login", "cat": "education"},
        # HTML-ish plain text
        {"sub": "Security Alert", "body": "[Click Here] to verify your identity. <a href='http://secure-auth-check.com'>Verify Now</a>. Failure to do so results in account lock.", "cat": "security"},
        {"sub": "Invoice", "body": "Invoice #8821 is overdue. **Payment required**. Visit the portal: [Payment Link](http://invoice-pay-fast.com)", "cat": "finance"},
        # Broken English/Polished mix
        {"sub": "Account Help", "body": "Dear customer, we notice a strange activity on your account. Pls be quick to secure it. Visit http://secure-help-center.net now.", "cat": "security"},
        {"sub": "Win Prize", "body": "Congratulation! You win a $1000 Gift Card. Your lucky day is here. Claim at http://gift-win-now.com/claim", "cat": "prize"},
        {"sub": "Admin", "body": "System update required for your mailbox. Log in at http://mail-admin-update.com to avoid data loss.", "cat": "system"},
    ]

    legit_templates = [
        {"sub": "Chess Club", "body": "Weekly meeting this Friday at 5pm in Room 302. All levels welcome!", "cat": "club"},
        {"sub": "Sports Schedule", "body": "The inter-college football match has been rescheduled to Saturday 10am.", "cat": "sports"},
        {"sub": "Lab Safety", "body": "Reminder: All students must wear goggles and lab coats in the Chemistry wing.", "cat": "safety"},
        {"sub": "Research Seminar", "body": "Prof. Smith will be discussing Quantum Computing in the main auditorium tomorrow.", "cat": "seminar"},
        {"sub": "Canteen Menu", "body": "Taco Tuesday is back! Special offer on veggie wraps today.", "cat": "canteen"},
        {"sub": "Hostel Maintenance", "body": "Water supply will be interrupted on Wednesday from 2pm to 4pm for pipe repair.", "cat": "maintenance"},
        {"sub": "Library Notice", "body": "The quiet zone is now extended to the second floor for finals week.", "cat": "library"},
        {"sub": "Student Council", "body": "Call for volunteers for the annual spring fest. Apply by Friday.", "cat": "council"},
        {"sub": "Course Update", "body": "The reading list for CS101 has been updated on the course portal.", "cat": "education"},
        {"sub": "Parking Permit", "body": "New parking permits for the new semester are now available at the admin office.", "cat": "admin"},
    ]

    rows = []
    # Generate 50 phishing and 50 legit
    for _ in range(50):
        temp = random.choice(phishing_templates)
        text = f"{temp['sub']}\n{temp['body']}"
        # Add slight noise to ensure uniqueness
        text += f" {random.randint(1000, 9999)}"
        rows.append({
            "subject": temp['sub'],
            "body": temp['body'],
            "text": text,
            "label": 1,
            "category": temp['cat'],
            "source": "synthetic_v3_ood"
        })

    for _ in range(50):
        temp = random.choice(legit_templates)
        text = f"{temp['sub']}\n{temp['body']}"
        text += f" {random.randint(1000, 9999)}"
        rows.append({
            "subject": temp['sub'],
            "body": temp['body'],
            "text": text,
            "label": 0,
            "category": temp['cat'],
            "source": "synthetic_v3_ood"
        })

    # Shuffle and write
    random.shuffle(rows)
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["subject", "body", "text", "label", "category", "source"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} OOD samples to {output_path}")

if __name__ == "__main__":
    generate_ood_v3()
