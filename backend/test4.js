import axios from 'axios';

async function test() {
  try {
    const url = "https://www.google.com/maps/place/Khyber+Restaurant+-+Dammam/@26.4357,50.1136,15z";
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    // Search for 0512345678 or something similar
    const cleanText = data.replace(/[\s\-]/g, '');
    const phoneRegex = /(?:(?:\+|00)966|0)?5\d{8}|(?:01|02|03|04|06|07|08|09)\d{7}|9200\d{5}|800\d{6}/g;
    const match = cleanText.match(phoneRegex);
    console.log("Matches:", match ? [...new Set(match)] : null);
    
    if (data.includes("051") || data.includes("05")) {
        console.log("Phone number found in raw HTML!");
    } else {
        console.log("Not found in HTML at all.");
    }
  } catch (error) {
    console.error(error.message);
  }
}

test();
