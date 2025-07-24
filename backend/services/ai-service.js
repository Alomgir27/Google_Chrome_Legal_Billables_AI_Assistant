const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,  //this is the openai api key and name is OPENAI_API_KEY
      baseURL: 'https://api.openai.com/v1',
    });
  }

  async generateBillableSummary(emailData) {
    const { recipient, subject, content } = emailData;
    console.log('Processing email for:', recipient, 'Subject:', subject);

    const prompt = `Transform the following email into a professional billable entry summary for legal time tracking. The summary should be concise, professional, and clearly describe the legal work performed.

Email Details:
To: ${recipient}
Subject: ${subject}
Content: ${content}

Create a billable entry summary that:
1. Is professional and client-appropriate
2. Describes the legal work performed (not just "sent email")
3. Is 1-2 sentences maximum
4. Uses proper legal terminology
5. Focuses on the substance of the communication

Example format: "Drafted correspondence to client regarding trial preparation and document requirements for upcoming hearing."

Billable Summary:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a legal billing assistant. Transform email content into professional billable entry summaries that accurately reflect the legal work performed. Keep summaries concise, professional, and focused on the legal substance."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      });

      const summary = completion.choices[0].message.content.trim();
      console.log('Generated AI summary:', summary);
      return summary;

    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }


}

module.exports = AIService; 