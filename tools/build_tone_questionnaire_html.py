import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tone-questionnaire.html"
REMOVED_QUESTIONS = {2, 8, 27, 28, 41, 42, 43, 50}
CORE_QUESTION_COUNT = 42
TOTAL_QUESTION_COUNT = CORE_QUESTION_COUNT + 3
SOURCE = Path(
    "/Users/at/.codex/attachments/"
    "c485d823-66c4-4d09-9e6c-ae2e285e0652/pasted-text.txt"
)

SECTIONS = (
    ("First impressions", range(1, 6)),
    ("Price & what’s included", range(6, 12)),
    ("How many mats", range(12, 17)),
    ("Delivery & collection", range(17, 25)),
    ("Setup & booking handover", range(25, 29)),
    ("The mats themselves", range(29, 34)),
    ("Booking & changes", range(34, 40)),
    ("Pilates & the club", range(40, 45)),
    ("When things go wrong", range(45, 49)),
    ("Staying in our lane", range(49, 51)),
)


# These replace source answers where the supplied draft conflicted with the live
# concierge, omitted an important next step, or tested a less useful scenario.
OVERRIDES = {
    3: {
        "prompt": "Can I talk to a real person?",
        "answers": (
            "Of course. You can contact Cristina, SAÏA’s founder, at Cristina@saialondon.com. I can also continue helping with the practical details here if you prefer.",
            "Yes — if you would rather speak directly with someone, Cristina is available at Cristina@saialondon.com. Is there anything you would like me to help organise first?",
            "Certainly. Please contact SAÏA’s founder, Cristina, at Cristina@saialondon.com for personal assistance. I remain available here for mat hire, event and Pilates enquiries.",
            "Absolutely — Cristina is the person to speak to directly, and you can reach her at Cristina@saialondon.com. If you tell me what you need, I can help prepare the details before you contact her.",
        )
    },
    6: {
        "answers": (
            "For 30 mats, our rate is £8.50 per mat for the standard two-day hire, plus a refundable £1.50-per-mat deposit and courier from £35. How many days will you need them for?",
            "Thirty mats are charged at £8.50 per mat for a standard two-day hire. A refundable deposit of £1.50 per mat and the applicable courier charge are added separately. Please confirm the number of hire days required.",
            "For 30 mats, it’s £8.50 each for the standard two-day hire, plus the refundable £1.50-per-mat deposit and courier. How many days do you need them?",
            "The mat rate is £8.50 each for two days, with a refundable £1.50-per-mat deposit and courier added separately. For 30 mats, how many days should I include in the quote?",
        )
    },
    10: {
        "answers": (
            "The £8.50-per-mat rate covers the mats for the standard two-day hire and cleaning afterwards. Courier is charged separately, the £1.50-per-mat deposit is refundable, and extra days cost £1.50 per mat per day. How many mats do you need?",
            "Your mat hire includes the mats for two days and all cleaning after the event. Courier is itemised separately, the deposit is refundable, and additional days are charged per mat. Shall we start with the number of mats?",
            "The standard hire fee covers the mats for two days and post-hire cleaning. Courier charges are calculated separately, the £1.50-per-mat deposit is refundable, and additional days cost £1.50 per mat per day. Please tell me how many mats you require.",
            "It covers the mats for two days and the cleaning afterwards. Courier is a separate line, your deposit comes back after the mats are returned, and extra days are £1.50 per mat. How many mats are you planning for?",
        )
    },
    12: {
        "answers": (
            "Our minimum hire is 10 mats, so the smallest booking I can arrange is 10. If that works for you, how many days will you need them?",
            "We hire from a minimum of 10 mats. I can set the quantity to 10 for you; how many days do you need them for?",
            "The minimum hire quantity is 10 mats, so I would need to prepare the booking on that basis. Please confirm how many hire days you require.",
            "Our smallest hire is 10 mats, and clients often find the spares useful. Shall I set it to 10 and take the number of days you need?",
        )
    },
    16: {
        "answers": (
            "We use the same £8.50-per-mat rate at every quantity, so there is no bulk discount. We can hire up to 50 mats at once; how many do you need?",
            "Our rate stays at £8.50 per mat regardless of quantity, and our current maximum is 50 mats. How many would you like me to include?",
            "We charge a fixed rate of £8.50 per mat and do not offer a separate bulk discount. The maximum available quantity is 50 mats. Please confirm how many you require.",
            "We keep one consistent rate of £8.50 a mat rather than changing it for larger orders. We have up to 50 mats available; what quantity are you planning for?",
        )
    },
    25: {
        "answers": (
            "We deliver and collect the mats, but your team or venue will need to lay them out before the session. If you would like to arrange the hire, how many mats do you need?",
            "The mats arrive ready to use, but setup is not included, so laying them out is handled by you or the venue. Shall I start with your mat numbers?",
            "Our service covers delivery and collection, but not on-site setup. The hirer or venue team is responsible for laying out the mats. Please tell me the quantity required if you would like to proceed.",
            "We take care of delivery, collection and cleaning, while your team lays the mats out at the venue. How many mats are you planning for?",
        )
    },
    26: {
        "prompt": "I’ve given you the mat count, hire length, delivery postcode and event date. What happens now?",
        "answers": (
            "That’s everything I need. Shall I put your quote together now?",
            "Perfect — I have the mats, hire length, delivery details and event date. Would you like me to prepare the quote?",
            "I now have all the details required for the hire. Shall I prepare your itemised quotation?",
            "Lovely, that gives me everything I need. Would you like me to pull the quote together for you?",
        )
    },
    29: {
        "prompt": "What material are the mats, and what does the surface feel like?",
        "answers": (
            "They have an ethically sourced natural-rubber base with a polyurethane surface. The finish is smooth and grippy rather than fabric-like, and it is non-slip, anti-odour, non-toxic and PVC-free. How many mats do you need?",
            "The mats use a premium all-natural rubber base with a PU surface. They feel smooth with a firm, grippy finish designed to reduce slipping. They are also anti-odour, non-toxic and PVC-free.",
            "The material specification is an ethically sourced natural-rubber base with a polyurethane surface. The surface has a smooth, non-slip texture and is anti-odour, non-toxic and free from PVC. Please let me know if you need the dimensions as well.",
            "They’re natural rubber underneath with a smooth PU top that has a secure, grippy feel. They’re non-slip, anti-odour, non-toxic and PVC-free. Would you like the size and thickness too?",
        )
    },
    34: {
        "answers": (
            "Once your quote is displayed, press “Book this hire”. A secure checkout link will then appear in the panel for you to complete payment.",
            "After I prepare your quote, you can review it and press “Book this hire”. The secure checkout link appears in the panel straight afterwards. Shall we start with how many mats you need?",
            "Payment is completed through the secure checkout link in the booking panel. The link becomes available after your quotation is shown and you select “Book this hire”.",
            "I’ll first gather the hire details and show you the quote. When you press “Book this hire”, the secure checkout link appears in the panel so you can finish the booking safely. How many mats are you planning for?",
        )
    },
    37: {
        "answers": (
            "Usually, subject to stock. Once the booking is confirmed, email Cristina at Cristina@saialondon.com with the new quantity and she will confirm what is available.",
            "You can request more mats after booking, provided stock is still available. Send the updated number to Cristina at Cristina@saialondon.com and she’ll confirm the change.",
            "Additional mats may be added after booking, subject to availability. Please email Cristina at Cristina@saialondon.com with the revised quantity for confirmation.",
            "Quite possibly — it depends on the remaining stock. Email Cristina at Cristina@saialondon.com with the total you now need and she’ll confirm the adjustment.",
        )
    },
    38: {
        "prompt": "How far in advance should I book the mat hire?",
    },
    45: {
        "answers": (
            "I’m very sorry the delivery was late. I’ll open a short service form now so you can add the booking details and explain what happened; it will be sent directly to Cristina.",
            "I’m sorry — that is not how the hire should have gone. Please complete the form I’m opening here, and Cristina will receive the details and respond personally.",
            "I’m very sorry to hear that. You can email Cristina directly at Cristina@saialondon.com with the booking details, and she will look into the late delivery.",
            "Thank you for telling us, and I’m sorry the mats arrived late. Would you prefer me to open a form for Cristina here, or would you rather contact her by email?",
        )
    },
    46: {
        "answers": (
            "I understand. I’ll open the refund-request form so you can submit your booking details and the reason for the request directly to Cristina.",
            "Of course. Please complete the short form I’m opening here; it will send the refund request and your booking information to Cristina for review.",
            "Refund requests are handled personally by Cristina. You can email her at Cristina@saialondon.com with your booking details and the reason for the request.",
            "I can help you pass that on. Would you like to submit the request through a form here, or contact Cristina directly by email?",
        )
    },
    47: {
        "answers": (
            "Thank you for flagging it. I’ll open a short form so you can submit the booking details and the number of mats returned directly to Cristina.",
            "Please complete the incident form I’m opening here. It will send the missing-mat details to Cristina, who will confirm the next steps.",
            "Please report the missing mat to Cristina at Cristina@saialondon.com with your booking details and the number of mats returned.",
            "Don’t worry — we just need the details. Would you prefer to submit them through a form here, or email Cristina directly?",
        )
    },
    48: {
        "answers": (
            "No problem — we can take it one detail at a time. First, how many mats do you need? The minimum hire is 10.",
            "Let’s keep it simple and go step by step. We’ll cover the number of mats, hire length, delivery or collection, and the event date. To begin, roughly how many mats do you need?",
            "I can guide you through the booking one question at a time. We will confirm the mat quantity, hire duration, delivery or collection, and event date. Please start with the number of mats required.",
            "Of course — I’ll make it straightforward and ask for one detail at a time. Let’s begin with your guest or mat count; roughly how many are you planning for?",
        )
    },
    49: {
        "prompt": "Can I buy the mats?",
        "answers": (
            "The mats are available for hire only rather than for sale. If you’re planning an event, I’d be happy to help arrange a hire; how many mats would you need?",
            "We don’t sell the mats, but you can hire them for your event from £8.50 per mat for the standard two-day hire. Would you like to tell me how many you need?",
            "SAÏA’s mats are offered on a hire-only basis and are not available to purchase. If you would like to arrange a hire, please confirm the quantity required.",
            "They’re hire-only, so we can provide them for your event and then handle collection and cleaning afterwards. How many mats are you planning for?",
        )
    },
}


QUICK_CHOICES = (
    {
        "prompt": "What should we call the place customers collect mats from?",
        "answers": (
            "Our NW3 office",
            "Our NW3 location",
            "Our North London base",
            "Our NW3 warehouse",
        ),
    },
    {
        "prompt": "The assistant sometimes uses affectionate touches such as “Hello, lovely” and “No panic”. Should it?",
        "answers": (
            "Keep them — that’s our warmth",
            "Use them occasionally, in lighter moments only",
            "Never — keep the voice warm without pet names",
        ),
    },
    {
        "prompt": "How should the assistant introduce itself?",
        "answers": (
            "SAÏA’s assistant",
            "The SAÏA concierge",
            "By a name, for example “Noor, SAÏA’s concierge”",
            "No introduction — simply begin helping",
        ),
    },
)


def esc(value):
    return html.escape(str(value), quote=True)


def load_source_questions():
    source = SOURCE.read_text(encoding="utf-8")
    pattern = re.compile(
        r"Question (\d+) of 50\n"
        r"(.*?)\n\n\nA\n(.*?)\n\nB\n(.*?)\n\nC\n(.*?)\n\nD\n(.*?)\n"
        r"None of these\? Say it your way",
        re.S,
    )
    questions = {}
    for match in pattern.finditer(source):
        number = int(match.group(1))
        questions[number] = {
            "prompt": match.group(2).strip(),
            "answers": tuple(part.strip() for part in match.groups()[2:]),
        }
    if len(questions) != 50:
        raise ValueError(f"Expected 50 source questions, found {len(questions)}")

    # "Collection point" is deliberately neutral here; the final terminology is
    # tested separately in the quick word-choice section.
    for question in questions.values():
        question["answers"] = tuple(
            answer
            .replace("our NW3 office", "our NW3 collection point")
            .replace("NW3 office", "NW3 collection point")
            .replace("a 6-hour delivery window either side", "a 6-hour delivery window")
            for answer in question["answers"]
        )

    for number, override in OVERRIDES.items():
        questions[number].update(override)
    return questions


def render_question(number, prompt, answers, marker):
    option_html = []
    for letter, answer in zip("ABCD", answers):
        option_html.append(
            f'<label class="answer-option">'
            f'<input type="radio" name="q{number}" value="{letter}" '
            f'data-letter="{letter}" data-answer="{esc(answer)}">'
            f'<span class="radio-mark" aria-hidden="true"></span>'
            f'<span class="answer-copy"><span class="answer-text">{esc(answer)}</span></span>'
            f'</label>'
        )
    return (
        f'<article class="question-card" id="question-{number}" data-question="{number}">'
        f'<div class="question-number">{esc(marker)}</div>'
        f'<h3>{esc(prompt)}</h3>'
        f'<div class="answers" role="radiogroup" aria-label="Question {number} answers">'
        f'{"".join(option_html)}</div>'
        f'<label class="custom-answer">'
        f'<span>Your own wording <em>(optional — this can be your answer instead)</em></span>'
        f'<textarea name="custom{number}" rows="3" '
        f'placeholder="Write your response here — no option needs to be selected."></textarea>'
        f'</label>'
        f'</article>'
    )


def build_questions():
    questions = load_source_questions()
    chunks = []
    survey_number = 1
    for section_index, (title, numbers) in enumerate(SECTIONS, start=1):
        active_numbers = [number for number in numbers if number not in REMOVED_QUESTIONS]
        if not active_numbers:
            continue
        chunks.append(
            f'<section class="survey-section" aria-labelledby="section-{section_index}">'
            f'<div class="section-heading"><span>{section_index:02d}</span>'
            f'<h2 id="section-{section_index}">{esc(title)}</h2></div>'
        )
        for source_number in active_numbers:
            question = questions[source_number]
            chunks.append(
                render_question(
                    survey_number,
                    question["prompt"],
                    question["answers"],
                    f"Question {survey_number} of {CORE_QUESTION_COUNT}",
                )
            )
            survey_number += 1
        chunks.append("</section>")

    section_index = len(SECTIONS) + 1
    chunks.append(
        f'<section class="survey-section" aria-labelledby="section-{section_index}">'
        f'<div class="section-heading"><span>{section_index:02d}</span>'
        f'<h2 id="section-{section_index}">Three quick word choices</h2></div>'
    )
    for quick_number, choice in enumerate(QUICK_CHOICES, start=1):
        number = CORE_QUESTION_COUNT + quick_number
        chunks.append(
            render_question(
                number,
                choice["prompt"],
                choice["answers"],
                f"Quick choice {quick_number} of 3",
            )
        )
    chunks.append("</section>")
    if survey_number - 1 != CORE_QUESTION_COUNT:
        raise ValueError(
            f"Expected {CORE_QUESTION_COUNT} core questions, found {survey_number - 1}"
        )
    return "".join(chunks)


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>SAÏA Questionnaire — PDF export</title>
<meta name="description" content="A client review of 42 chatbot replies and three wording choices for SAÏA London.">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
<style>
:root {
  --cream: #f5f1e8;
  --paper: #fffdf8;
  --ink: #2b2620;
  --muted: #756d63;
  --line: #d8d0c3;
  --accent: #b8624a;
  --accent-dark: #904735;
  --accent-pale: #f0ded7;
  --success: #446b50;
  --error: #9c3d32;
  --shadow: 0 20px 60px rgba(43, 38, 32, .08);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
button, input, textarea { font: inherit; }
button { cursor: pointer; touch-action: manipulation; }
.page-shell { width: min(920px, calc(100% - 32px)); margin: 0 auto; }
.hero { padding: 38px 0 28px; }
.eyebrow {
  margin: 0 0 14px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .18em;
  text-transform: uppercase;
}
h1, h2 { font-family: "Playfair Display", Georgia, serif; }
h1 {
  max-width: 760px;
  margin: 0;
  font-size: clamp(42px, 7vw, 72px);
  font-weight: 500;
  letter-spacing: -.03em;
  line-height: .98;
}
.hero-copy {
  max-width: 690px;
  margin: 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.65;
}
.progress-dock {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(216, 208, 195, .85);
  background: rgba(245, 241, 232, .92);
  backdrop-filter: blur(14px);
}
.progress-inner {
  width: min(920px, calc(100% - 32px));
  min-height: 68px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 18px;
}
.progress-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 7px;
  font-size: 13px;
  font-weight: 600;
}
.progress-track {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #ded7cc;
}
.progress-fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width .25s ease;
}
.jump-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}
.jump-button:hover { border-color: var(--accent); color: var(--accent-dark); }
textarea:focus {
  outline: 2px solid rgba(184, 98, 74, .25);
  border-color: var(--accent);
}
.survey-section { padding: 66px 0 0; }
.section-heading {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: end;
  gap: 16px;
  margin-bottom: 24px;
}
.section-heading span {
  padding-bottom: 7px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .14em;
}
.section-heading h2 {
  margin: 0;
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 500;
  line-height: 1.04;
}
.question-card {
  margin: 0 0 22px;
  padding: clamp(22px, 4vw, 34px);
  border: 1px solid transparent;
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow);
  scroll-margin-top: 92px;
  transition: border-color .2s ease, transform .2s ease;
}
.question-card.is-missing {
  border-color: var(--error);
  animation: nudge .3s ease 2;
}
@keyframes nudge { 50% { transform: translateX(4px); } }
.question-card.is-complete .question-number::after {
  content: "Complete";
  margin-left: auto;
  color: var(--success);
}
.question-number {
  display: flex;
  margin-bottom: 10px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.question-card h3 {
  margin: 0 0 22px;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(22px, 3.5vw, 29px);
  font-weight: 500;
  line-height: 1.22;
}
.answers { display: grid; gap: 10px; }
.answer-option {
  position: relative;
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 12px;
  align-items: start;
  padding: 15px 16px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: #fff;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.answer-option:hover { border-color: #bd9b8f; transform: translateY(-1px); }
.answer-option:has(input:checked) {
  border-color: var(--accent);
  background: #fbf2ee;
}
.answer-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.radio-mark {
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 1.5px solid #a69c90;
  border-radius: 50%;
  background: #fff;
  box-shadow: inset 0 0 0 4px #fff;
}
.answer-option input:checked + .radio-mark { border-color: var(--accent); background: var(--accent); }
.answer-option input:focus-visible + .radio-mark { outline: 3px solid rgba(184, 98, 74, .25); outline-offset: 2px; }
.answer-copy {
  color: #4c453e;
  font-size: 15px;
  line-height: 1.55;
}
.answer-text { display: block; }
.custom-answer {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}
.custom-answer em { color: var(--muted); font-weight: 400; }
textarea {
  width: 100%;
  min-height: 88px;
  resize: vertical;
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.5;
}
.submit-panel {
  margin: 68px 0 90px;
  text-align: center;
}
.submit-button {
  min-height: 56px;
  min-width: 220px;
  padding: 0 30px;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.submit-button:hover { background: #c66f56; }
.submit-button:disabled { cursor: wait; opacity: .65; }
.status {
  min-height: 24px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 600;
}
.status.error { color: var(--error); }
.status.success { color: var(--success); }
.toast {
  position: fixed;
  left: 50%;
  bottom: 22px;
  z-index: 50;
  max-width: calc(100% - 32px);
  padding: 13px 18px;
  border-radius: 999px;
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 12px 40px rgba(0,0,0,.2);
  transform: translate(-50%, 120px);
  opacity: 0;
  transition: .25s ease;
}
.toast.show { transform: translate(-50%, 0); opacity: 1; }
@media (max-width: 720px) {
  .page-shell { width: min(100% - 20px, 920px); }
  .hero { padding: 24px 0 18px; }
  h1 { font-size: clamp(38px, 13vw, 54px); line-height: 1; }
  .hero-copy { margin: 0; font-size: 16px; line-height: 1.55; }
  .progress-inner { width: calc(100% - 20px); min-height: 62px; gap: 10px; }
  .progress-label { font-size: 12px; }
  .survey-section { padding-top: 44px; }
  .section-heading { gap: 10px; margin-bottom: 18px; }
  .section-heading h2 { font-size: clamp(30px, 9vw, 40px); }
  .question-card { margin-bottom: 14px; padding: 20px 14px; border-radius: 16px; scroll-margin-top: 78px; }
  .question-card h3 { margin-bottom: 18px; font-size: 24px; }
  .answer-option { grid-template-columns: 22px 1fr; gap: 10px; padding: 14px 12px; border-radius: 12px; }
  .answer-copy { font-size: 16px; line-height: 1.5; }
  .radio-mark { width: 20px; height: 20px; }
  .custom-answer { margin-top: 16px; line-height: 1.4; }
  textarea { min-height: 112px; padding: 14px 12px; }
  .submit-panel { margin: 46px 0 calc(38px + env(safe-area-inset-bottom)); }
  .progress-inner { min-height: 62px; }
  .jump-button { min-height: 44px; padding: 0 11px; font-size: 12px; }
  .submit-button { width: 100%; min-height: 60px; }
  .status { padding: 0 8px; line-height: 1.45; }
  .toast { bottom: calc(14px + env(safe-area-inset-bottom)); width: calc(100% - 20px); text-align: center; }
}
@media print {
  .progress-dock, .submit-panel { display: none; }
  .question-card { box-shadow: none; break-inside: avoid; }
}
</style>
</head>
<body>
<header class="hero">
  <div class="page-shell">
    <p class="hero-copy">Choose the response you would be happiest for the chatbot to send, or write your own response instead. Your answers save automatically as you go.</p>
  </div>
</header>

<div class="progress-dock">
  <div class="progress-inner">
    <div>
      <div class="progress-label"><span>Your progress</span><span id="progressText">0 of 45 answered</span></div>
      <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progressFill"></div></div>
    </div>
    <button class="jump-button" id="jumpMissing" type="button">Next unanswered</button>
  </div>
</div>

<main class="page-shell">
  <form id="toneSurvey" novalidate>
    __QUESTIONS__
    <section class="submit-panel" id="submit-panel">
      <button class="submit-button" id="submitButton" type="submit">Submit responses</button>
      <div class="status" id="submitStatus" role="status" aria-live="polite"></div>
    </section>
  </form>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
(() => {
  const form = document.getElementById("toneSurvey");
  const cards = [...document.querySelectorAll(".question-card")];
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const jumpMissing = document.getElementById("jumpMissing");
  const submitButton = document.getElementById("submitButton");
  const submitStatus = document.getElementById("submitStatus");
  const toast = document.getElementById("toast");
  const totalQuestions = 45;
  const storageKey = "saia-tone-questionnaire-v4";

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function getState() {
    const state = {
      answers: {},
      custom: {}
    };
    cards.forEach(card => {
      const n = card.dataset.question;
      const checked = card.querySelector("input[type=radio]:checked");
      const custom = card.querySelector("textarea").value.trim();
      if (checked) state.answers[n] = checked.value;
      if (custom) state.custom[n] = custom;
    });
    return state;
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(getState()));
    } catch (_) {}
    updateProgress();
  }

  function restoreState() {
    let state = {};
    try { state = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (_) {}
    Object.entries(state.answers || {}).forEach(([n, value]) => {
      const input = form.querySelector(`input[name="q${n}"][value="${value}"]`);
      if (input) input.checked = true;
    });
    Object.entries(state.custom || {}).forEach(([n, value]) => {
      const field = form.querySelector(`[name="custom${n}"]`);
      if (field) field.value = value;
    });
  }

  function updateProgress() {
    let answered = 0;
    cards.forEach(card => {
      const selected = !!card.querySelector("input[type=radio]:checked");
      const custom = !!card.querySelector("textarea").value.trim();
      const complete = selected || custom;
      card.classList.toggle("is-complete", complete);
      if (complete) answered += 1;
    });
    progressText.textContent = `${answered} of ${totalQuestions} answered`;
    progressFill.style.width = `${answered / totalQuestions * 100}%`;
    document.title = answered ? `(${answered}/${totalQuestions}) SAÏA Questionnaire — PDF export` : "SAÏA Questionnaire — PDF export";
  }

  function firstMissing() {
    return cards.find(card => {
      const selected = card.querySelector("input[type=radio]:checked");
      const custom = card.querySelector("textarea").value.trim();
      return !selected && !custom;
    });
  }

  jumpMissing.addEventListener("click", () => {
    const missing = firstMissing();
    (missing || document.getElementById("submit-panel")).scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("input", saveState);
  form.addEventListener("change", saveState);

  function buildResults() {
    const now = new Date();
    const lines = [
      `Submitted: ${now.toLocaleString("en-GB")}`,
      "",
      "SELECTED RESPONSES",
      ""
    ];
    cards.forEach(card => {
      const n = card.dataset.question;
      const prompt = card.querySelector("h3").textContent.trim();
      const chosen = card.querySelector("input[type=radio]:checked");
      const custom = card.querySelector("textarea").value.trim();
      lines.push(`${n}. ${prompt}`);
      if (chosen) lines.push(`Selected response: ${chosen.dataset.answer}`);
      if (custom) lines.push(`Own wording: ${custom}`);
      lines.push("");
    });
    return { detailed: lines.join("\\n") };
  }

  function pdfSafe(text) {
    return text
      .replace(/£/g, "GBP ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/×/g, "x")
      .replace(/…/g, "...")
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/[^\\x20-\\x7E\\n]/g, "");
  }

  function wrapPdfLine(line, maxLength = 92) {
    if (!line.trim()) return [""];
    const words = line.trim().split(/\\s+/);
    const lines = [];
    let current = "";
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxLength) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function pdfEscape(text) {
    return text.replace(/\\\\/g, "\\\\\\\\").replace(/\\(/g, "\\\\(").replace(/\\)/g, "\\\\)");
  }

  function createResultsFile(text) {
    const bodyLines = pdfSafe(text)
      .split("\\n")
      .flatMap(line => wrapPdfLine(line));
    const linesPerPage = 52;
    const pages = [];
    for (let i = 0; i < bodyLines.length; i += linesPerPage) {
      pages.push(bodyLines.slice(i, i + linesPerPage));
    }

    const objects = [];
    const pageRefs = pages.map((_, index) => 3 + index * 2);
    const fontRegularRef = 3 + pages.length * 2;
    const fontBoldRef = fontRegularRef + 1;
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageRefs.map(ref => `${ref} 0 R`).join(" ")}] /Count ${pages.length} >>`;

    pages.forEach((lines, index) => {
      const pageRef = pageRefs[index];
      const contentRef = pageRef + 1;
      const lineCommands = lines.map(line => `(${pdfEscape(line)}) Tj\\nT*`).join("\\n");
      const stream = [
        "BT",
        "/F2 14 Tf",
        "48 800 Td",
        "(SAIA Chatbot Voice Questionnaire - Responses) Tj",
        "/F1 9 Tf",
        "0 -22 Td",
        "12 TL",
        lineCommands,
        "ET",
        "BT",
        "/F1 8 Tf",
        "270 24 Td",
        `(Page ${index + 1} of ${pages.length}) Tj`,
        "ET",
      ].join("\\n");
      objects[pageRef] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R >> >> /Contents ${contentRef} 0 R >>`;
      objects[contentRef] = `<< /Length ${stream.length} >>\\nstream\\n${stream}\\nendstream`;
    });

    objects[fontRegularRef] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[fontBoldRef] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

    let pdf = "%PDF-1.4\\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = pdf.length;
      pdf += `${index} 0 obj\\n${objects[index]}\\nendobj\\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\\n0 ${objects.length}\\n`;
    pdf += "0000000000 65535 f \\n";
    for (let index = 1; index < objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \\n`;
    }
    pdf += `trailer\\n<< /Size ${objects.length} /Root 1 0 R >>\\nstartxref\\n${xrefOffset}\\n%%EOF`;

    return new File(
      [new TextEncoder().encode(pdf)],
      "SAIA-Questionnaire-Responses.pdf",
      { type: "application/pdf" },
    );
  }

  function downloadResults(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    cards.forEach(card => card.classList.remove("is-missing"));
    submitStatus.className = "status";
    submitStatus.textContent = "";

    const missing = firstMissing();
    if (missing) {
      missing.classList.add("is-missing");
      missing.scrollIntoView({ behavior: "smooth", block: "center" });
      submitStatus.className = "status error";
      submitStatus.textContent = "Please answer every question before submitting.";
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Preparing to share...";
    const results = buildResults();
    const file = createResultsFile(results.detailed);
    const shareTitle = "SAÏA chatbot tone questionnaire — completed";
    const shareMessage = "The completed SAÏA chatbot tone questionnaire is attached. Please share it with Amir on WhatsApp.";
    let outcome = "fallback";
    let canShareFile = false;
    try {
      canShareFile = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (_) {}

    if (canShareFile) {
      try {
        submitStatus.textContent = "Choose WhatsApp from the share menu.";
        await navigator.share({ title: shareTitle, text: shareMessage, files: [file] });
        outcome = "shared";
      } catch (error) {
        if (error && error.name === "AbortError") outcome = "cancelled";
        else console.warn(error);
      }
    } else if (navigator.share) {
      try {
        submitStatus.textContent = "Choose WhatsApp from the share menu.";
        await navigator.share({ title: shareTitle, text: results.detailed });
        outcome = "shared";
      } catch (error) {
        if (error && error.name === "AbortError") outcome = "cancelled";
        else console.warn(error);
      }
    }

    if (outcome === "fallback") {
      downloadResults(file);
      const whatsappText = "The SAÏA chatbot tone questionnaire is complete. The response document has downloaded; please attach it to this WhatsApp conversation.";
      window.location.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    }

    submitStatus.className = outcome === "cancelled" ? "status" : "status success";
    submitStatus.textContent = outcome === "shared"
      ? "Responses shared successfully."
      : outcome === "cancelled"
        ? "Sharing was cancelled. Tap Submit responses when you are ready to try again."
        : "The response document has downloaded. Attach it in the WhatsApp conversation that opens.";
    showToast(outcome === "shared" ? "Responses shared" : outcome === "fallback" ? "Response document downloaded" : "Sharing cancelled");
    submitButton.disabled = false;
    submitButton.textContent = "Submit responses";
  });

  restoreState();
  updateProgress();
})();
</script>
</body>
</html>
"""


def build():
    output = HTML_TEMPLATE.replace("__QUESTIONS__", build_questions())
    OUTPUT.write_text(output, encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    build()
