import axios from 'axios';

async function test() {
  try {
    const url = "https://www.google.com/maps/place/Khyber+Restaurant+-+Dammam/@26.4357,50.1136,15z";
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    const telMatch = data.match(/tel:([+\d]+)/g);
    console.log("Tel matches:", telMatch);
  } catch (error) {
    console.error(error.message);
  }
}

test();
