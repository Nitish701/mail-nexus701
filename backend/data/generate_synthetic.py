import csv
import random

# categories for phishing (label 1)
phishing_cats = {
    "credential": [
        ("Security Alert: Account Verification Required", "Your account has been flagged for unusual activity. To prevent temporary suspension, please verify your credentials at the University Portal immediately."),
        ("Password Expiration Notice", "Your campus password expires in 24 hours. To avoid lockout from your email and student portal, please update your password now via the secure link provided."),
        ("Action Required: Update Your Login Information", "Our security system detected an unauthorized login attempt. For your protection, we require you to re-verify your identity on our portal."),
        ("Verification of Identity Needed", "To maintain access to your student services, please complete the identity verification process via the campus security page."),
        ("Account Sync Issue", "Your account is not syncing with the new campus directory. Please log in to the portal to manually synchronize your profile."),
        ("Urgent: Login Security Update", "We are upgrading our security protocols. All users are required to sign in to the new authentication portal to validate their accounts."),
    ],
    "invoice": [
        ("Payment Overdue: Invoice #INV-99281", "Your last payment for student services is overdue. Please settle the balance immediately to avoid a late fee and registration hold."),
        ("Urgent: Unpaid Tuition Balance", "Our records show an outstanding balance on your account. Please review the attached invoice and pay via the secure gateway."),
        ("Notice of Pending Charge", "A charge for your recent library equipment rental is pending. Please verify your payment method on the billing portal."),
        ("Important: Fee Adjustment Notification", "A correction has been made to your semester fees. Please log in to the finance portal to approve the new amount."),
        ("Invoice for Campus Parking Permit", "Your parking permit renewal invoice is ready. Please pay now to ensure your vehicle is not towed from campus."),
        ("Notification of Refund Processing", "A refund is available for your course materials. Provide your banking details on the secure refund portal to receive payment."),
    ],
    "exam_portal": [
        ("Exam Portal: Final Grade Release", "Your final exam grades are now available. Please log in to the Student Exam Portal to view your results and feedback."),
        ("Important: Online Exam Access Credentials", "Your credentials for the upcoming online final are now ready. Sign in to the portal to download your secure access key."),
        ("Course Assessment: Mandatory Survey", "All students must complete the course evaluation survey before the final grade can be released. Log in to the portal to start."),
        ("Scholarship Application Status", "The results for the campus merit scholarship are now available. Log in to the scholarship portal to see your status."),
        ("Exam Scheduling Update", "There has been a change to your exam time. Please check the scheduling portal immediately to confirm your new slot."),
        ("University Portal: Degree Audit Notice", "Your degree audit is complete. Please review the requirements on the portal to ensure you are on track for graduation."),
    ],
    "it_support": [
        ("IT Support: Mailbox Full", "Your campus mailbox has reached its storage limit. To prevent incoming emails from being bounced, please expand your quota via the IT portal."),
        ("VPN Access Update", "The campus VPN is undergoing maintenance. Please re-authenticate your device through the IT support page to maintain access."),
        ("Urgent: System Maintenance Required", "Your workstation is out of compliance with university security standards. Please run the remote update tool from the IT helpdesk."),
        ("Notification: New Software Available", "A mandatory security update is available for your student laptop. Log in to the software center to install it."),
        ("IT Alert: Unusual Network Activity", "Our monitoring system detected a potential security breach from your IP. Please contact IT support via the portal to verify your session."),
        ("Password Reset Request Received", "A request to reset your password was received. If this was not you, please log in to your account settings to secure your profile."),
    ],
    "urgent_action": [
        ("URGENT: Final Notice Regarding Your Account", "This is your final warning. Your account will be permanently deleted if you do not verify your identity within 12 hours."),
        ("Critical Security Breach: Immediate Action Required", "A critical vulnerability was found in your account. Sign in to the security dashboard immediately to patch your profile."),
        ("Immediate Action: Tuition Payment Failure", "The payment for your tuition failed. Please update your credit card details on the portal now to avoid being dropped from your classes."),
        ("Urgent: Mandatory Compliance Training", "You have not completed the mandatory compliance training. Please log in to the training portal today to avoid a fine."),
        ("Notice: Account Access Restricted", "Your access to campus resources has been restricted. To restore access, please validate your credentials on the portal."),
        ("Warning: Unauthorized Access Detected", "Someone from an unknown location tried to access your account. Please change your password immediately via the secure link."),
    ]
}

# categories for legitimate (label 0)
ham_cats = {
    "ham_admin": [
        ("Campus Health Update", "The campus health clinic has extended its hours for the upcoming flu season. Walk-ins are welcome from 8am to 8pm."),
        ("HR Policy Notice: Remote Work", "The updated remote work policy is now available on the employee handbook. Please review the changes to the flexible hours section."),
        ("Administrative Notice: Facility Maintenance", "The main library will be closed this Saturday for routine electrical maintenance. We apologize for the inconvenience."),
        ("University Newsletter: October Edition", "Read about our latest research breakthroughs and upcoming campus events in this month's newsletter."),
        ("Parking Permit Renewal Dates", "Renewal for the winter parking permits begins on November 1st. Applications can be submitted online."),
        ("New Campus Security Guidelines", "Please review the updated safety guidelines for late-night study sessions in the student union."),
    ],
    "ham_student": [
        ("Course Schedule: Fall Semester", "Your finalized class schedule is now available for download. Please check for any room changes before Monday."),
        ("Assignment Reminder: History 101", "Just a reminder that your first essay is due this Friday by 11:59 PM via the course submission link."),
        ("Library Hours for Finals Week", "The library will be open 24/7 during the finals period from December 10th to the 20th."),
        ("Study Group: Biology Lab", "Hey everyone, let's meet in the lab on Tuesday at 4 PM to go over the results for the second experiment."),
        ("Student Union Event: Career Fair", "The annual spring career fair is happening next Wednesday. Many top firms will be attending. Hope to see you there!"),
        ("Campus Dining Menu Update", "The dining hall has introduced several new vegetarian and vegan options for the current semester."),
    ],
    "ham_meeting": [
        ("Meeting Notes: Project Sync", "Thanks for the productive meeting today. We agreed to move the deadline to next Friday and split the documentation tasks."),
        ("Weekly Team Catch-up", "Hi all, let's move our weekly sync to 3 PM today to accommodate the guest speaker's schedule."),
        ("Meeting Request: Budget Review", "Could we schedule a brief 15-minute call on Thursday morning to go over the Q3 budget estimates?"),
        ("Agenda for Tomorrow's Board Meeting", "Please find the attached agenda for tomorrow's board meeting. We will focus on the expansion plan."),
        ("Recap: Vendor Demo Session", "The demo from the software vendor was quite impressive. I've attached the slide deck for those who missed it."),
        ("Follow-up: Interview Feedback", "I've reviewed the candidate's portfolio. I think they would be a great fit for the junior developer role."),
    ],
    "ham_general": [
        ("Welcome to the Team!", "We are thrilled to have you on board. Your onboarding schedule is attached, and your mentor will contact you shortly."),
        ("Thank you for the Introduction", "It was great meeting you at the conference. I've copied my colleague who handles the partnerships on this email."),
        ("Request for Updated Slides", "Could you please send over the updated slides for the board meeting by tomorrow morning? Thanks!"),
        ("Project Deadline Extension", "Good news! The project deadline has been extended to next Friday. Please update your task boards accordingly."),
        ("Invitation: Faculty Mixer", "You are cordially invited to the annual faculty mixer this Friday evening at the Student Union lounge."),
        ("Campus Wifi Connectivity Issue", "We are aware of the intermittent wifi issues in the North Building. Our team is working to resolve it."),
    ]
}

def generate_synthetic_data(output_path, target_rows=120):
    data = []

    # Generate Phishing Rows
    phishing_rows = []
    all_phishing_samples = []
    for cat, samples in phishing_cats.items():
        for subj, body in samples:
            all_phishing_samples.append((subj, body, cat))

    # To get to ~60 rows, we need to vary them.
    # We'll use a base set and apply some simple variations to ensure uniqueness.
    while len(phishing_rows) < target_rows // 2:
        subj, body, cat = random.choice(all_phishing_samples)
        # Simple variation: rotate some words or slightly change phrasing if we had more templates
        # For now, we'll just ensure we don't have exact duplicates by keeping track.
        text = f"{subj}\\n{body}"
        if not any(row[2] == text for row in phishing_rows):
            phishing_rows.append((subj, body, text, 1, cat))

        # If we run out of unique base samples, we'll create some synthetic variants
        if len(phishing_rows) >= len(all_phishing_samples) and len(phishing_rows) < target_rows // 2:
            s, b, c = random.choice(all_phishing_samples)
            # Artificial variation
            variants = [
                (f"URGENT: {s}", b),
                (s, f"PLEASE NOTE: {b}"),
                (s, f"{b} Action is required immediately."),
                (f"Action Required - {s}", b),
            ]
            vs, vb = random.choice(variants)
            vtext = f"{vs}\\n{vb}"
            if not any(row[2] == vtext for row in phishing_rows):
                phishing_rows.append((vs, vb, vtext, 1, c))

    # Generate Legitimate Rows
    ham_rows = []
    all_ham_samples = []
    for cat, samples in ham_cats.items():
        for subj, body in samples:
            all_ham_samples.append((subj, body, cat))

    while len(ham_rows) < target_rows // 2:
        subj, body, cat = random.choice(all_ham_samples)
        text = f"{subj}\\n{body}"
        if not any(row[2] == text for row in ham_rows):
            ham_rows.append((subj, body, text, 0, cat))

        if len(ham_rows) >= len(all_ham_samples) and len(ham_rows) < target_rows // 2:
            s, b, c = random.choice(all_ham_samples)
            variants = [
                (f"Re: {s}", b),
                (s, f"Hi, {b}"),
                (s, f"{b} Thanks!"),
                (f"Update: {s}", b),
            ]
            vs, vb = random.choice(variants)
            vtext = f"{vs}\\n{vb}"
            if not any(row[2] == vtext for row in ham_rows):
                ham_rows.append((vs, vb, vtext, 0, c))

    # Combine and shuffle
    final_data = phishing_rows + ham_rows
    random.shuffle(final_data)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["subject", "body", "text", "label", "category", "source"])
        for row in final_data:
            # replace the literal \\n with a real newline for the text column
            subj, body, text, label, cat = row
            writer.writerow([subj, body, text.replace("\\n", "\n"), label, cat, "synthetic_v1"])

if __name__ == "__main__":
    generate_synthetic_data("Mail-nexus/backend/data/synthetic_phishing_v1.csv")
