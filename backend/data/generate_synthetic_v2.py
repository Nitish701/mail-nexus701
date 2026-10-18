import csv
import random

# Harder, more subtle phishing templates (label 1)
phishing_templates = {
    "credential": [
        ("Security Update: Account Review", "A routine security review of your campus account is now required. Please take a moment to confirm your current login details through the student portal to ensure uninterrupted access."),
        ("MFA Setup Required", "The university is migrating to a new Multi-Factor Authentication system. To avoid being locked out of your email, please register your mobile device via the security center."),
        ("Account Access Notification", "We noticed a login attempt from an unrecognized device. If this was not you, please secure your account by validating your identity on the portal."),
        ("Password Management Notice", "Your organizational password is scheduled for a mandatory update. Please visit the account management page to select a new secure password."),
        ("Identity Verification Request", "To comply with updated campus privacy regulations, all users must re-verify their primary identity documents via the secure portal."),
        ("Synchronize Your Campus Profile", "Your student profile is currently out of sync with the central directory. Please sign in to the profile manager to resolve this discrepancy."),
    ],
    "invoice": [
        ("Payment Confirmation Required", "A discrepancy was found in your recent tuition payment. Please review the transaction details on the billing portal to avoid a registration hold."),
        ("Notice regarding your refund", "You are eligible for a partial refund of your laboratory fees. Please provide your updated banking information through the secure finance portal."),
        ("Invoice for Outstanding Balance", "Our records indicate a small remaining balance on your account from the previous semester. You can settle this easily via the online payment gateway."),
        ("Vendor Payment Update", "The payment for your requested research materials has been processed. Please confirm the delivery address on the vendor portal."),
        ("Urgent: Tuition Fee Adjustment", "A correction has been made to your financial aid package. Please log in to the student finance dashboard to approve the adjustment."),
        ("Parking Permit Billing Issue", "There was an error processing the payment for your parking permit. Please update your payment method in the portal to ensure your permit remains active."),
    ],
    "exam_portal": [
        ("Final Grade Notification", "Your final assessments for the current term have been graded. You may now view your marks and instructor feedback on the Exam Portal."),
        ("Exam Access Credentials", "Your secure access key for the upcoming online final is now available. Please sign in to the portal to retrieve your unique code."),
        ("Mandatory Course Evaluation", "Course evaluations are now open. Please complete the survey on the student portal before your final grades can be processed."),
        ("Merit Scholarship Status", "The selection committee has finalized the scholarship awards. Please log in to the scholarship dashboard to check your status."),
        ("Exam Slot Confirmation", "There has been a minor adjustment to your exam schedule. Please review the changes on the portal to confirm your new time."),
        ("Degree Audit: Missing Requirements", "A preliminary audit shows a missing requirement for your graduation. Please review the details on the portal to resolve this."),
    ],
    "it_support": [
        ("Mailbox Quota Warning", "Your campus email storage is nearly full. To prevent incoming messages from being blocked, please request a quota increase via the IT support portal."),
        ("VPN Connectivity Update", "We are updating the VPN configuration for remote access. Please re-authenticate your device through the helpdesk page to maintain connectivity."),
        ("Software Compliance Notice", "Your registered device is missing a critical security patch. Please visit the software center to install the mandatory update."),
        ("IT Helpdesk: Ticket Update", "Regarding your recent support request, we have a solution ready. Please log in to the ticket portal to view the resolution steps."),
        ("Network Security Alert", "Our system detected unusual traffic patterns originating from your account. Please verify your current session on the security portal."),
        ("Remote Desktop Access Reset", "Your remote desktop permissions have expired. Please re-validate your credentials through the IT support page to restore access."),
    ],
    "shared_doc": [
        ("Shared Document: Project Requirements", "A colleague has shared a document with you titled 'Project Requirements'. Please review the content and add your comments via the portal."),
        ("Invitation to Collaborate", "You have been invited to collaborate on a new research paper. Click here to access the shared folder and view the draft."),
        ("Urgent: Document Review Needed", "Please review the attached faculty guidelines and provide your digital signature through the secure document portal."),
        ("Shared Folder Access", "A new folder 'Campus Resources' has been shared with you. You can access the files by signing in to the shared drive."),
        ("Feedback Request: Course Syllabus", "The department head has shared the new syllabus for your review. Please provide your feedback on the portal by Friday."),
        ("Notice: Shared File Update", "The shared project timeline has been updated. Please check the revised dates on the collaboration portal."),
    ]
}

# Harder legitimate templates (label 0) - "Hard Negatives"
ham_templates = {
    "ham_portal_reminder": [
        ("Student Portal Update", "The student portal will be undergoing scheduled maintenance this Sunday from 2 AM to 6 AM. Access will be limited during this time."),
        ("Reminder: Enrollment Window", "The window for course registration opens next Monday. We recommend logging into the portal early to secure your preferred sections."),
        ("Portal Login Issues", "We are aware that some users are experiencing slow load times on the student portal. Our team is currently optimizing the database."),
        ("Updating Your Profile", "You can now update your emergency contact information directly through the student portal under the 'My Profile' section."),
        ("Portal Access for New Students", "Welcome new students! You can now activate your campus account and access the student portal using the instructions sent to your personal email."),
        ("Digital ID Card Availability", "Your digital campus ID is now available. You can view and download it from the student portal mobile app."),
    ],
    "ham_admin": [
        ("Campus Health Guidelines", "The university has released updated health and safety guidelines for the upcoming semester. Please review them on the administration page."),
        ("HR Policy: Holiday Schedule", "The official holiday schedule for the current academic year has been posted to the employee handbook."),
        ("Facility Notice: Library Renovation", "The east wing of the library will be closed for renovations starting next month. Please use the west wing for study spaces."),
        ("Monthly Campus Newsletter", "Stay updated with the latest campus news and student achievements in our monthly newsletter, now available on the main site."),
        ("Parking Permit Information", "Information regarding the winter parking permit application process is now available on the campus services website."),
        ("New Safety Protocols", "The campus security office has introduced new protocols for after-hours building access. Please refer to the safety manual."),
    ],
    "ham_student": [
        ("Course Schedule Finalized", "Your class schedule for the fall semester is now final. Please check the registrar's office for any last-minute room changes."),
        ("Assignment Deadline Reminder", "This is a friendly reminder that your History 101 essay is due this Friday. Please submit it via the usual course link."),
        ("Finals Week Library Hours", "To support students during finals, the library will remain open 24 hours a day from December 10th to the 20th."),
        ("Biology Lab Study Group", "Hi all, just confirming we'll meet in the lab this Tuesday at 4 PM to analyze the data from our second experiment."),
        ("Career Fair Announcement", "The annual spring career fair is taking place next Wednesday in the Student Union. Many employers will be attending."),
        ("Dining Hall Menu Changes", "The dining hall has added several new healthy options to the daily menu. Check the website for the full weekly schedule."),
    ],
    "ham_meeting": [
        ("Meeting Notes: Team Sync", "Thanks for the meeting. We've agreed to extend the project deadline by one week and split the remaining documentation tasks."),
        ("Weekly Sync Time Change", "Hi everyone, let's move today's weekly sync to 3 PM to accommodate the guest speaker's arrival."),
        ("Budget Review Request", "Could we find 15 minutes on Thursday morning to briefly discuss the Q3 budget estimates? Let me know your availability."),
        ("Board Meeting Agenda", "Please find the attached agenda for tomorrow's board meeting. The primary focus will be the campus expansion plan."),
        ("Vendor Demo Recap", "The demo from the software provider was very promising. I've attached the recording and slides for those who missed it."),
        ("Interview Feedback: Candidate", "I've reviewed the portfolio for the junior developer candidate. I believe they would be a strong addition to the team."),
    ],
    "ham_general": [
        ("Welcome to the Department!", "We're excited to have you join us. Your onboarding packet is attached, and your mentor will reach out shortly."),
        ("Conference Introduction", "It was a pleasure meeting you at the conference last week. I've cc'd my colleague who manages our partnerships."),
        ("Request for Presentation Slides", "Could you please send over the updated slides for the board meeting by tomorrow morning? Many thanks!"),
        ("Project Timeline Extension", "Good news: the project deadline has been pushed back to next Friday. Please update your task boards."),
        ("Faculty Mixer Invitation", "You are cordially invited to the annual faculty mixer this Friday evening at the Student Union lounge."),
        ("Campus Wifi Update", "We are investigating reports of intermittent wifi connectivity in the North Building. We appreciate your patience."),
    ],
    "ham_hard_neg": [
        ("Reminder: Portal Password Update", "As a reminder, it is good practice to update your portal password every six months. You can do this in your account settings."),
        ("Student Portal: Mandatory Training", "Please remember to complete the mandatory online orientation training via the portal by the end of the week."),
        ("Portal Access for Alumni", "Alumni can now access a limited version of the student portal to request official transcripts and diplomas."),
        ("Secure Login Instructions", "For those having trouble with the new login system, please refer to the 'Help' section on the main login page."),
        ("Portal Notification: Grade Change", "A grade change has been processed for one of your courses. You can view the updated mark on the student portal."),
        ("Account Recovery Process", "If you have forgotten your password, you can use the 'Forgot Password' link on the portal to start the recovery process."),
    ]
}

def generate_v2_data(output_path, target_rows=240):
    data = []

    # Generate Phishing Rows (label 1)
    phishing_rows = []
    all_phishing_samples = []
    for cat, samples in phishing_templates.items():
        for subj, body in samples:
            all_phishing_samples.append((subj, body, cat))

    while len(phishing_rows) < target_rows // 2:
        subj, body, cat = random.choice(all_phishing_samples)

        # Apply a variety of subtle paraphrasing to avoid duplicates and templates
        variations = [
            (subj, body),
            (f"Notice: {subj}", body),
            (subj, f"Dear User, {body}"),
            (subj, f"{body} Please attend to this at your earliest convenience."),
            (f"Update regarding {subj.lower()}", body),
            (subj, f"Hello, {body} Thank you."),
        ]
        vs, vb = random.choice(variations)
        text = f"{vs}\\n{vb}"

        if not any(row[2] == text for row in phishing_rows):
            phishing_rows.append((vs, vb, text, 1, cat))

    # Generate Legitimate Rows (label 0)
    ham_rows = []
    all_ham_samples = []
    for cat, samples in ham_templates.items():
        for subj, body in samples:
            all_ham_samples.append((subj, body, cat))

    while len(ham_rows) < target_rows // 2:
        subj, body, cat = random.choice(all_ham_samples)

        variations = [
            (subj, body),
            (f"Re: {subj}", body),
            (subj, f"Hi, {body}"),
            (subj, f"{body} Best regards."),
            (f"Update: {subj}", body),
            (subj, f"Hello everyone, {body}"),
        ]
        vs, vb = random.choice(variations)
        text = f"{vs}\\n{vb}"

        if not any(row[2] == text for row in ham_rows):
            ham_rows.append((vs, vb, text, 0, cat))

    # Combine and shuffle
    final_data = phishing_rows + ham_rows
    random.shuffle(final_data)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["subject", "body", "text", "label", "category", "source"])
        for row in final_data:
            subj, body, text, label, cat = row
            writer.writerow([subj, body, text.replace("\\n", "\n"), label, cat, "synthetic_v2"])

if __name__ == "__main__":
    generate_v2_data("Mail-nexus/backend/data/synthetic_phishing_v2.csv")
