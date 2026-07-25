import * as cheerio from 'cheerio';

const html = `
<div class="fontHeadlineSmall">Khyber Restaurant - Dammam مطعم خيبر</div>
<span role="img" aria-label="4.5 stars 100 Reviews">
  <span aria-hidden="true">4.5</span>
</span>
<span aria-label="100 reviews">(100)</span>
<span>Pakistani restaurant</span>
`;

const $ = cheerio.load(html);
const text = $.root().text();
console.log("Text:", text);

const cleanText = text.replace(/\u200E/g, '').replace(/\u200F/g, '');

const ratingRegex = /([0-9\u0660-\u0669]+[\.,][0-9\u0660-\u0669]+)\s*\([0-9\u0660-\u0669,]+\)/;
const match = cleanText.match(ratingRegex);
console.log("Match:", match);

// Let's also check aria-label
const ariaLabel = $('span[role="img"]').attr('aria-label');
console.log("Aria-label:", ariaLabel);
