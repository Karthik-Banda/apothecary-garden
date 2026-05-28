🌱 Apothecary Garden

A frontend React application for planning, managing, and utilizing a medicinal plant garden.

I built this after attending the Generative AI Mastermind by Vaibhav Sisinty (Outskill). I wanted to build something beyond a standard CRUD to-do list, so I created a virtual garden planner that actually integrates Google's Gemini API directly into the client-side code for real-time plant identification and Ayurvedic remedy formulation.

🚀 What It Actually Does

Interactive Garden Grid: A 50-slot virtual garden map where you can plant, arrange, and harvest medicinal herbs.

The Apothecary: Cross-references the plants currently growing in your virtual garden against a list of common ailments to suggest actionable, natural recipes (like teas and salves).

AI Plant & Disease ID: Upload a photo of any plant or sick leaf. The app converts the image to Base64, pings the Gemini Vision API, and returns the plant's name, health benefits, and organic pest treatments.

AI Ayurvedic Consultant & "Magic Extract": A built-in chatbot that suggests plants based on your symptoms. If it suggests a plant you don't have, you can click "Magic Extract" to instantly generate an SVG placeholder and inject that new plant permanently into your local Plant Library and Garden Palette.

Local State Persistence: Uses localStorage under the hood so your dynamic library, garden layout, and journal entries are never lost on refresh.

🧠 The Build Process & Bugs I Squashed

Integrating an LLM into a frontend app sounds easy until you actually try to deploy it in a local sandbox. Here are a few walls I hit and how I got past them:

1. The "Model Not Found" 404 Sandbox Error
Initially, trying to hit standard endpoints like gemini-1.5-flash kept throwing HTTP 404 errors. It turns out that depending on your Google Cloud Console region and how the local sandbox routes network requests, default models get blocked.

The Fix: I had to write a custom exponential backoff fetcher and specifically target the gemini-3-flash-preview endpoint (or use dynamic model discovery) to bypass the sandbox routing restrictions.

2. The Emoji Base64 Crash
When building the "Magic Extract" feature, I needed to generate placeholder images for newly discovered plants. I tried using the JavaScript btoa() function to encode an SVG containing a Leaf emoji (🌿).

The Fix: JavaScript's btoa() function silently crashes when it encounters characters outside the standard Latin alphabet (like emojis). I had to rewrite the image generator to use encodeURIComponent instead, which safely processes the emojis into the data URI.

🛠️ Tech Stack

Frontend: React.js (Hooks, Custom UI components)

Styling: Tailwind CSS

Icons: Lucide-React

AI Integration: Google Gemini API (gemini-3-flash-preview / gemini-1.5-pro)

⚙️ How to Run Locally

Clone the repository:

git clone https://github.com/yourusername/apothecary-garden.git


Navigate into the directory and install dependencies:

cd apothecary-garden
npm install


Start the development server:

npm run dev


Using the AI: To use the Plant Advisor and Image ID tools, navigate to the App.jsx file, locate the apiKey variable in the Tools component, and paste your free Google AI Studio API Key.