// প্রয়োজনীয় মডিউল ইম্পোর্ট করুন
const axios = require('axios');

// --- কনফিগারেশন ---

// এখানে আপনার সম্পূর্ণ Clio Access Token টি পেস্ট করুন
const ACCESS_TOKEN = '20912-VNAnQ9C9ADEvxTZtM5mmWFA15sqIttuEtI'; // যেমন: '20912-VNAnQ9C9ADEvxTZtM5mmWFA15sqIttuEtI...'

// Clio API-এর বেস ইউআরএল (US Region)। প্রয়োজনে পরিবর্তন করুন (eu, ca, au)
const API_BASE_URL = 'https://app.clio.com';

// ডামি ডেটা যা আপনি Clio-তে পাঠাতে চান
const DUMMY_ACTIVITY_DATA = {
    "type": "TimeEntry",
    "date": "2025-07-19",  // Today's date
    "quantity": 1.5,      // Example: 1.5 hours
    "price": 200.0,       // Hourly rate
    "note": "Initial consultation and case review with the client (via direct token script).",
    "no_charge": true,  // If no charge for this activity
    "non_billable": true,  // If the activity is non-billable
    "tax_setting": "no_tax",  // Tax setting, can be "no_tax", "included", or "excluded"
    "reference": "string"
};



/**
 * Access Token ব্যবহার করে Clio-তে একটি Activity (Time Entry) তৈরি করে
 * @param {string} accessToken - আপনার Clio Access Token
 */
async function createActivity(accessToken) {
    // অ্যাক্সেস টোকেন দেওয়া হয়েছে কিনা তা পরীক্ষা করুন
    if (!accessToken || accessToken === 'আপনার_সম্পূর্ণ_অ্যাক্সেস_টোকেন_এখানে_পেস্ট_করুন') {
        console.error('❌ ত্রুটি: অনুগ্রহ করে কোডের মধ্যে আপনার আসল ACCESS_TOKEN সেট করুন।');
        return; // ফাংশন চালানো বন্ধ করুন
    }

    try {
        const apiUrl = `${API_BASE_URL}/api/v4/activities.json`;
        
        // API তে পাঠানোর জন্য ডেটা র‍্যাপ করতে হবে
        const postData = {
            data: DUMMY_ACTIVITY_DATA
        };
        
        console.log('Clio-তে Activity (Time Entry) তৈরি করা হচ্ছে...');
        const response = await axios.post(apiUrl, postData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`, // সরাসরি টোকেন ব্যবহার করা হচ্ছে
                'Content-Type': 'application/json'
            }
        });

        console.log('\n==========================================================');
        console.log('✅ সফলভাবে Clio-তে Time Entry তৈরি করা হয়েছে!');
        console.log('==========================================================');
        console.log('তৈরি হওয়া এন্ট্রির বিবরণ:');
        console.log(JSON.stringify(response.data.data, null, 2));

    } catch (error) {
        console.error('❌ Activity তৈরি করতে সমস্যা হয়েছে:');
        if (error.response) {
            // যদি টোকেন ভুল বা মেয়াদোত্তীর্ণ হয়, তাহলে 401 Unauthorized एरर আসবে
            if (error.response.status === 401) {
                 console.error(`স্ট্যাটাস: 401 Unauthorized - আপনার Access Token টি সম্ভবত ভুল অথবা মেয়াদোত্তীর্ণ।`);
            } else {
                 console.error(`স্ট্যাটাস: ${error.response.status}`);
            }
            console.error('Clio API থেকে পাওয়া एरर:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

/**
 * মূল ফাংশন যা পুরো প্রক্রিয়াটি চালায়
 */
function main() {
    console.log("🚀 Clio API তে সরাসরি ডেটা পাঠানোর প্রক্রিয়া শুরু হচ্ছে...");
    // সরাসরি createActivity ফাংশনটি কল করুন
    createActivity(ACCESS_TOKEN);
}

// প্রোগ্রাম শুরু করুন
main();