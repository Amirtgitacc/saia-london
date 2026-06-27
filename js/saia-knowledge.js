/* ============================================================
   SAÏA — shared knowledge base (single source of truth)
   Read by BOTH brains so they can never drift:
     • Tier 1 (planner.js)   — scripted, deterministic replies
     • Tier 2 (server.js)    — injected into the "Noor" system prompt
   Dual-mode: attaches to window.SAIA.KB in the browser and
   exports for Node (require) on the server.
   Facts sourced from the live saialondon.com (2026-06-20).
   PRIORITY ORDER: mat hire → community → yoga/Pilates.
   ============================================================ */
(function (root, factory) {
  var KB = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = KB;
  if (typeof window !== 'undefined') { (window.SAIA = window.SAIA || {}).KB = KB; }
})(this, function () {
  var KB = {
    /* ---- contact (one channel, one person) ---- */
    contact: {
      whatsapp: '07444 611 914',           // Cristina — quickest for urgent hires
      person: 'Cristina',
      area: 'London',
      pickup: 'NW3 (North London) warehouse, working hours only',
      forms: 'contact form on saialondon.com',
      social: { instagram: '@saialondon', facebook: 'saialondon', pinterest: 'saialondon' },
    },

    /* ---- PRIORITY #1 — MAT HIRE ---- */
    hire: {
      pricePerMat: 8.5,                     // £ per mat, 2-day hire
      currency: '£',
      hireDays: 2,                          // day before the event → end of event
      minMats: 10,
      extraDayPerMat: 1.5,                  // £ per mat per additional day
      bulkThreshold: 60,                    // 60+ → reduced quote, get in touch
      delivery: 'Same-day courier (Addison Lee) from our Central London warehouse, roughly £35 to £55 each way across London.',
      collection: 'We collect the day after your event, or you can drop them back at our NW3 warehouse in working hours. No need to clean them. We handle that.',
      noSale: true,                         // HIRE ONLY — never for sale
      retailReference: 79,                  // £ retail value, reference only (not for sale)
      mat: {
        size: '68 × 185 cm, 4 mm thick',
        colour: 'black',
        material: 'ethically sourced, premium all-natural rubber base with a PU surface',
        features: 'non-slip, anti-odour, non-toxic and PVC-free',
      },
      tagline: 'If you are looking to organise a wellness event, you have landed in the right place.',
    },

    /* ---- PRIORITY #2 — COMMUNITY / THE CLUB ---- */
    club: {
      what: 'A female-led lifestyle brand empowering women through Fitness, Community and Mindset.',
      ethos: 'A SAÏA woman is not afraid to speak her truth, and is someone who inspires and lifts up other women.',
      join: 'Free guest list. Pop your email in to hear about upcoming experiences.',
      taglines: ['The SAÏA Club', 'Join the SAÏA Community'],
    },

    /* ---- PRIORITY #3 — YOGA / PILATES ---- */
    pilates: {
      instructor: 'Cristina',
      method: 'Classical Pilates and Reformer: small, slow and breath-led, drawn from Joseph Pilates’ Contrology. Pilates for women, every level; Cristina meets you where you are.',
      format: '1-2-1 classes in NW3 and group classes in Hampstead, London.',
      booking: 'Tell me a day that suits and I’ll hold you a place; final booking is confirmed with Cristina.',
    },

    /* ---- FOUNDER ---- */
    founder: {
      name: 'Cristina',
      bio: 'Cristina is an English-Mexican entrepreneur in London and an advocate for female empowerment. She founded SAÏA in 2020, starting with yoga mats and bags, then created the monthly SAÏA Brunch Club and grew it into dinner parties, book clubs and 5k runs in Hyde Park, and she attends every event herself.',
      meaning: 'SAÏA means “A Woman Who Wins”, inspired by her great-grandmother Calandita, a Mexican farm worker who sold a cow to finance her escape from farm life. Cristina credits her courage and self-belief.',
    },

    /* ---- EVENTS (recent SAÏA experiences) ---- */
    events: [
      'SAÏA Brunch Club at Mortimer House',
      'Watercolour Painting in Regent’s Park',
      'SAÏA Book Club & Afternoon Tea at Petersham Nurseries',
      'Talk & Bottomless Brunch with Self Love London',
      'Brunch Club at The Nest with Pilates by Riya',
    ],
  };

  /* A compact markdown fact-sheet for the Tier-2 system prompt.
     Built from the structured fields above so it can never disagree. */
  KB.factSheet = [
    '## SAÏA LONDON: what you (Noor) know',
    '',
    'SAÏA is ' + KB.club.what + ' ' + KB.founder.meaning,
    '',
    '### Mat hire (your #1 priority: this is what most people want)',
    '- Mats are for HIRE ONLY. Never for sale.',
    '- ' + KB.hire.currency + KB.hire.pricePerMat.toFixed(2) + ' per mat for a ' + KB.hire.hireDays + '-day hire (the day before the event through the end of it).',
    '- Minimum ' + KB.hire.minMats + ' mats. Extra days are ' + KB.hire.currency + KB.hire.extraDayPerMat.toFixed(2) + ' per mat per day. ' + KB.hire.bulkThreshold + '+ mats → reduced quote, get in touch.',
    '- Delivery: ' + KB.hire.delivery,
    '- Collection: ' + KB.hire.collection,
    '- The mat: ' + KB.hire.mat.size + ', ' + KB.hire.mat.colour + ', ' + KB.hire.mat.material + '; ' + KB.hire.mat.features + '. (Retail value ~' + KB.hire.currency + KB.hire.retailReference + ' each, for reference only, still hire-only.)',
    '- Booking/urgent: WhatsApp ' + KB.contact.person + ' on ' + KB.contact.whatsapp + '. Pickup at ' + KB.contact.pickup + '.',
    '',
    '### Community / the club (#2)',
    '- ' + KB.club.ethos,
    '- Joining: ' + KB.club.join,
    '- Recent experiences: ' + KB.events.join('; ') + '.',
    '',
    '### Yoga / Pilates with Cristina (#3)',
    '- ' + KB.pilates.method + ' ' + KB.pilates.format,
    '- Booking: ' + KB.pilates.booking,
    '',
    '### Founder',
    '- ' + KB.founder.bio,
    '',
    '### Contact',
    '- WhatsApp ' + KB.contact.person + ': ' + KB.contact.whatsapp + ' · Instagram ' + KB.contact.social.instagram + ' · ' + KB.contact.area + ' (' + KB.contact.pickup + ').',
  ].join('\n');

  return KB;
});
