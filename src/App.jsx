import React, { useState, useEffect } from "react";
// We import icons from lucide-react to make our UI look modern and clean without loading heavy image files.
import {
  Home,
  Map,
  BookOpen,
  Heart,
  Bug,
  Search,
  Users,
  Sun,
  Loader2,
  Sparkles,
  Droplets,
  Wind,
  X,
  Check,
  Plus,
  Sprout,
  ThermometerSun,
  Calendar,
  Leaf,
  Image as ImageIcon,
  Camera,
  AlertTriangle,
  Bot,
} from "lucide-react";

// This is our fallback database. If a user opens the app for the very first time and has no saved data in their browser,
// we populate their library with these common medicinal plants so the app isn't empty.
const INITIAL_PLANTS = [
  {
    id: "1",
    name: "Aloe Vera",
    type: "Succulent",
    difficulty: "Easy",
    zone: "9-11",
    light: "Full/Part Sun",
    soil: "7.0-8.5",
    healing: ["Burns", "Skin Care"],
    companion: ["Onion"],
    imageUrl: "/aloe-vera.jpg",
    description:
      "A soothing succulent known for treating burns and skin irritation. Requires minimal watering and well-draining soil.",
  },
  {
    id: "2",
    name: "Mint",
    type: "Herb",
    difficulty: "Easy",
    zone: "3-11",
    light: "Part Sun",
    soil: "6.0-7.0",
    healing: ["Digestion", "Headaches"],
    companion: ["Tomatoes"],
    imageUrl: "/mint.jpg",
    description:
      "Highly fragrant and excellent for soothing stomachs. Grows rapidly and is best kept in containers to prevent spreading.",
  },
  {
    id: "3",
    name: "Rosemary",
    type: "Shrub",
    difficulty: "Moderate",
    zone: "7-10",
    light: "Full Sun",
    soil: "6.0-7.0",
    healing: ["Memory", "Focus"],
    companion: ["Sage"],
    imageUrl: "/rosemary.jpg",
    description:
      "A woody perennial herb with fragrant, evergreen, needle-like leaves. Great for culinary and medicinal uses.",
  },
  {
    id: "4",
    name: "Basil",
    type: "Herb",
    difficulty: "Easy",
    zone: "10-11",
    light: "Full Sun",
    soil: "6.0-7.5",
    healing: ["Stress relief", "Inflammation"],
    companion: ["Tomatoes"],
    imageUrl: "/basil.jpg",
    description:
      "A popular culinary herb with strong medicinal properties. Loves warm weather and regular pruning.",
  },
  {
    id: "5",
    name: "Ginger",
    type: "Root",
    difficulty: "Moderate",
    zone: "9-12",
    light: "Part Sun",
    soil: "5.5-6.5",
    healing: ["Nausea", "Digestion"],
    companion: ["Turmeric"],
    imageUrl: "/ginger.jpg",
    description:
      "A tropical plant whose rhizome is a powerful anti-inflammatory and digestive aid.",
  },
  {
    id: "6",
    name: "Garlic",
    type: "Bulb",
    difficulty: "Easy",
    zone: "3-8",
    light: "Full Sun",
    soil: "6.0-7.0",
    healing: ["Immunity", "Blood Pressure"],
    companion: ["Roses"],
    imageUrl: "/garlic.jpg",
    description:
      "A natural antibiotic and immune booster. Plant individual cloves in the fall for a summer harvest.",
  },
  {
    id: "7",
    name: "Thyme",
    type: "Herb",
    difficulty: "Easy",
    zone: "5-9",
    light: "Full Sun",
    soil: "6.0-8.0",
    healing: ["Coughs", "Sore Throat"],
    companion: ["Rosemary"],
    imageUrl: "/thyme.jpg",
    description:
      "A low-growing herb with strong antibacterial properties. Thrives in dry, well-drained conditions.",
  },
  {
    id: "8",
    name: "Lavender",
    type: "Flower",
    difficulty: "Moderate",
    zone: "5-9",
    light: "Full Sun",
    soil: "6.5-7.5",
    healing: ["Anxiety", "Sleep"],
    companion: ["Mint"],
    imageUrl: "/lavender.jpg",
    description:
      "Calming aromatherapy and skin healing. Requires excellent drainage and full sun exposure.",
  },
];

// --- NETWORK UTILITIES ---

// fetchWithBackoff: A robust way to handle API calls.
// Why do we need this? External APIs (like Google's Gemini) can fail randomly due to network hiccups or rate limits.
// Instead of crashing the app on a single failure, this function catches the error, waits a short delay (which doubles each time), 
// and tries again up to the specified number of retries.
const fetchWithBackoff = async (url, options, retries = 5) => {
  let delay = 1000; // Start with a 1-second delay
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      // If the response isn't a 200 OK, we manually throw an error to trigger the catch block below
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `HTTP ${response.status}: ${
            errorData?.error?.message || "Unknown API error"
          }`
        );
      }
      return await response.json();
    } catch (error) {
      // If we are on our very last retry, give up and pass the error back to the component
      if (i === retries - 1) throw error;
      // Otherwise, wait for the delay period before looping again
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Double the delay for the next attempt (Exponential backoff)
    }
  }
};

// discoverValidModel: Smart model routing for Gemini AI.
// Different Google API keys have access to different AI models depending on the account's tier or region.
// This function pings Google to get a list of models allowed for the current key, checks it against our preferred list,
// and returns the best, fastest model available. This prevents 404 "Model Not Found" errors.
const discoverValidModel = async (apiKey) => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return "gemini-1.5-flash"; // Fallback if the discovery ping fails
    
    const data = await res.json();
    // We only care about models that can actually generate content
    const validModels = (data.models || []).filter(m => m.supportedGenerationMethods?.includes("generateContent"));
    
    // We prefer the 1.5 flash or pro models because they are fast and support both text and images
    const preferred = ["models/gemini-1.5-flash", "models/gemini-1.5-pro", "models/gemini-pro"];
    for (const pref of preferred) {
       // If our key supports the preferred model, return just the identifier string (e.g., 'gemini-1.5-flash')
       if (validModels.some(m => m.name === pref)) return pref.split("/")[1];
    }
    // If our preferred models aren't available, just pick the first valid one we found
    if (validModels.length > 0) return validModels[0].name.split("/")[1];
    return "gemini-1.5-flash";
  } catch (e) {
    return "gemini-1.5-flash";
  }
};


// --- REUSABLE UI COMPONENTS ---

// Card: A simple wrapper component to keep all our dashboard cards looking consistent.
const Card = ({ children, className = "", onClick = undefined }) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-[#E2D9C8] shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

// Toast: A temporary notification popup that slides up from the bottom of the screen.
const Toast = ({ message, isError = false }) => {
  if (!message) return null; // Don't render anything if there's no message
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${isError ? "bg-red-800" : "bg-[#4A3B32]"} text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce-short flex items-center gap-2 whitespace-nowrap`}>
      {isError ? <AlertTriangle size={18} className="text-red-300" /> : <Check size={18} className="text-[#C86B52]" />}
      {message}
    </div>
  );
};


// --- MAIN VIEWS / PAGES ---

// Dashboard: The landing page of the application providing high-level stats.
const Dashboard = ({ setCurrentView, gardenGrid, journalEntries }) => {
  // Count how many cells in the gardenGrid actually have a plant object in them
  const activePlants = gardenGrid.filter((p) => p !== null).length;

  return (
    <div className="space-y-8 animate-fade-in h-full overflow-y-auto pr-2 pb-10">
      <header>
        <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">Welcome Back, Herbalist</h1>
        <p className="text-gray-600">Your natural pharmacy is thriving today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-br from-[#4A3B32] to-[#604E42] text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/80 text-sm">Active Plants</p>
              <h2 className="text-4xl font-serif mt-1">{activePlants}</h2>
            </div>
            <Sprout size={32} className="text-[#C86B52]" />
          </div>
          <button onClick={() => setCurrentView("garden")} className="text-sm text-[#E2D9C8] hover:text-white flex items-center gap-1 transition-colors">
            Manage Garden <Plus size={14} />
          </button>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-[#C86B52] to-[#D97D64] text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/80 text-sm">Harvests Logged</p>
              <h2 className="text-4xl font-serif mt-1">{journalEntries.length}</h2>
            </div>
            <Calendar size={32} className="text-[#F9F6F0]" />
          </div>
          <button onClick={() => setCurrentView("garden")} className="text-sm text-[#F9F6F0] hover:text-white flex items-center gap-1 transition-colors">
            View Journal <BookOpen size={14} />
          </button>
        </Card>

        <Card className="p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setCurrentView("apothecary")}>
          <div className="w-12 h-12 bg-[#F9F6F0] rounded-full flex items-center justify-center mb-3">
            <Heart size={24} className="text-[#C86B52]" />
          </div>
          <h3 className="font-serif text-[#4A3B32] text-lg">Formulate Remedy</h3>
          <p className="text-sm text-gray-500 mt-1">Create medicines from your harvest</p>
        </Card>
      </div>

      <div>
        <h3 className="text-2xl font-serif text-[#4A3B32] mb-4">Recent Journal Entries</h3>
        {journalEntries.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-dashed border-[#C86B52]/40 text-center">
            <BookOpen className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500">No harvests logged yet. Visit your garden to start harvesting!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* We slice and reverse the entries so the newest logs show up at the top */}
            {journalEntries.slice().reverse().map((entry, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-[#E2D9C8] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#E2D9C8]/50 flex items-center justify-center text-xl shrink-0">🌱</div>
                  <div>
                    <h4 className="font-medium text-[#4A3B32]">Harvested {entry.plant}</h4>
                    <p className="text-sm text-gray-500">{entry.amount} • {new Date(entry.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Library: Displays all known plants. Allows filtering by text search, category, and favorites.
const Library = ({ setDrawerPlant, favorites, toggleFavorite, libraryPlants }) => {
  // Local state to manage the UI filters
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("name-asc");

  const categories = ["All", "Favorites", "Herbs", "Succulents", "Full Sun", "Easy to Grow"];

  // Core Filtering Logic
  // We start with the full list and chain filter/sort methods based on the current state.
  let filteredPlants = libraryPlants.filter(
    (p) =>
      // Check if the plant name matches the search box OR if one of its healing properties matches
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.healing && p.healing.some((h) => h.toLowerCase().includes(search.toLowerCase())))
  );

  // Apply the selected category filter
  if (activeCategory === "Favorites") {
    filteredPlants = filteredPlants.filter((p) => favorites.includes(p.id));
  } else if (activeCategory === "Herbs") {
    filteredPlants = filteredPlants.filter((p) => p.type === "Herb");
  } else if (activeCategory === "Succulents") {
    filteredPlants = filteredPlants.filter((p) => p.type === "Succulent");
  } else if (activeCategory === "Full Sun") {
    filteredPlants = filteredPlants.filter((p) => (p.light || "").includes("Full Sun"));
  } else if (activeCategory === "Easy to Grow") {
    filteredPlants = filteredPlants.filter((p) => p.difficulty === "Easy");
  }

  // Apply the selected sorting logic
  if (sortBy === "name-asc") {
    filteredPlants.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sortBy === "zone") {
    filteredPlants.sort((a, b) => (a.zone || "").localeCompare(b.zone || ""));
  } else if (sortBy === "type") {
    filteredPlants.sort((a, b) => (a.type || "").localeCompare(b.type || ""));
  }

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in pr-2">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 shrink-0">
        <div>
          <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">Plant Library</h1>
          <p className="text-gray-600">Discover medicinal plants and their healing properties.</p>
        </div>
        <div className="flex flex-col gap-3 w-full xl:w-auto">
          <div className="flex gap-2 relative w-full">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              {/* Updating this input changes 'search' state, instantly re-rendering the filtered list */}
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#E2D9C8] focus:outline-none focus:border-[#C86B52] bg-white"/>
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2.5 text-sm rounded-xl border border-[#E2D9C8] bg-white text-[#4A3B32] focus:outline-none focus:border-[#C86B52]">
              <option value="name-asc">Sort A-Z</option>
              <option value="zone">Sort by Zone</option>
              <option value="type">Sort by Type</option>
            </select>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {/* Render out our category buttons and highlight the active one */}
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat ? "bg-[#C86B52] text-white shadow-sm" : "bg-white border border-[#E2D9C8] text-gray-600 hover:border-[#C86B52]"}`}>
                {cat === "Favorites" ? (<span className="flex items-center gap-1"><Heart size={12} className={activeCategory === "Favorites" ? "fill-white" : "fill-gray-400 text-gray-400"}/> {cat}</span>) : (cat)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        {filteredPlants.length === 0 ? (
          <div className="text-center py-20">
            <Leaf className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl text-[#4A3B32] font-serif">No plants found</h3>
            <p className="text-gray-500">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlants.map((plant) => (
              <Card key={plant.id} className="cursor-pointer group hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col h-full" onClick={() => setDrawerPlant(plant)}>
                <div className="h-44 bg-[#E2D9C8]/40 relative flex items-center justify-center overflow-hidden shrink-0">
                  <img src={plant.imageUrl} alt={plant.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded shadow text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm ${plant.difficulty === "Easy" ? "text-[#6B8E23]" : "text-[#C86B52]"}`}>
                    {plant.difficulty}
                  </div>
                  {/* e.stopPropagation() prevents the whole card from being clicked when we only want to click the heart icon */}
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(plant.id); }} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-colors">
                    <Heart size={18} className={favorites.includes(plant.id) ? "fill-[#C86B52] text-[#C86B52]" : "text-white"}/>
                  </button>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-xl font-serif text-[#4A3B32] mb-1">{plant.name}</h3>
                  <p className="text-sm text-[#C86B52] font-medium mb-3">{plant.type} • Zone {plant.zone}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {/* Render up to 2 healing properties as little pill tags */}
                    {plant.healing && plant.healing.slice(0, 2).map((heal, i) => (
                      <span key={i} className="text-[11px] bg-[#F9F6F0] border border-[#E2D9C8] text-gray-600 px-2 py-1 rounded-md">{heal}</span>
                    ))}
                    {/* If there are more than 2, group the rest in a "+X more" tag */}
                    {plant.healing && plant.healing.length > 2 && (
                      <span className="text-[11px] bg-transparent text-gray-400 px-1 py-1 rounded-md">+{plant.healing.length - 2} more</span>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-[#E2D9C8]/60 flex items-center gap-4 text-xs text-gray-500 font-medium">
                    <span className="flex items-center gap-1.5"><Sun size={14} className="text-yellow-600" /> {plant.light}</span>
                    <span className="flex items-center gap-1.5"><Droplets size={14} className="text-blue-500" /> pH {plant.soil}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Garden: The interactive 50-cell grid planner.
const Garden = ({ gardenGrid, setGardenGrid, showToast, journalEntries, setJournalEntries, libraryPlants }) => {
  const [selectedPalettePlant, setSelectedPalettePlant] = useState(null); // The plant currently selected from the top carousel
  const [harvestPlantIndex, setHarvestPlantIndex] = useState(null); // Which grid cell did the user click to open the harvest modal?
  const [yieldAmount, setYieldAmount] = useState("");
  const [isPlanning, setIsPlanning] = useState(false); // Controls the loading spinner for AI auto-plan

  // Handles clicking a square in the 50-cell grid
  const handleCellClick = (index) => {
    // Scenario 1: A plant is selected in the palette and the user clicked an empty grid cell. Let's plant it!
    if (selectedPalettePlant) {
      if (!gardenGrid[index]) {
        const newGrid = [...gardenGrid]; // Create a copy of the state array to avoid mutating it directly
        newGrid[index] = selectedPalettePlant;
        setGardenGrid(newGrid);
        showToast(`Planted ${selectedPalettePlant.name}!`);
        setSelectedPalettePlant(null); // Deselect the palette item after planting
      }
    } 
    // Scenario 2: No plant is selected in the palette, but the user clicked a cell that already has a plant. Open harvest menu.
    else if (gardenGrid[index]) {
      setHarvestPlantIndex(index);
    }
  };

  // Called from the harvest modal to push a new entry into the journal state
  const handleLogHarvest = () => {
    if (!yieldAmount.trim()) {
      showToast("Please enter a yield amount.", true);
      return;
    }
    const plant = gardenGrid[harvestPlantIndex];
    // Spread operator (...journalEntries) keeps the old entries, while we append the new object
    setJournalEntries([...journalEntries, { plant: plant.name, amount: yieldAmount, date: new Date().toISOString() }]);
    setYieldAmount("");
    setHarvestPlantIndex(null); // Close the modal
    showToast("Harvest logged in journal!");
  };

  // Called from the harvest modal to delete the plant from the grid
  const handleRemovePlant = () => {
    const newGrid = [...gardenGrid];
    newGrid[harvestPlantIndex] = null; // Setting the specific cell index to null removes the plant
    setGardenGrid(newGrid);
    setHarvestPlantIndex(null); // Close the modal
    showToast("Plant removed from garden.");
  };

  // Simulate an AI planting logic by randomly picking plants from the library to fill empty spots
  const autoPlanGarden = () => {
    setIsPlanning(true);
    setTimeout(() => {
      setGardenGrid((prevGrid) => {
        const newGrid = [...prevGrid];
        let plantedCount = 0;
        
        // Find the index numbers of all empty cells
        const emptyIndices = [];
        for (let i = 0; i < newGrid.length; i++) {
          if (!newGrid[i]) emptyIndices.push(i);
        }
        
        // We only want to plant a maximum of 3 plants per click so we don't overwhelm the user
        const spotsToFill = Math.min(3, emptyIndices.length);
        
        for (let i = 0; i < spotsToFill; i++) {
          // Pick a random empty cell index from our tracked list
          const randomEmptyIdx = Math.floor(Math.random() * emptyIndices.length);
          const targetCell = emptyIndices[randomEmptyIdx];
          emptyIndices.splice(randomEmptyIdx, 1); // Remove it from the empty list so we don't pick it again
          
          // Assign a random plant from the library to that cell
          newGrid[targetCell] = libraryPlants[Math.floor(Math.random() * libraryPlants.length)];
          plantedCount++;
        }
        
        // Triggers the toast UI safely after state updates
        setTimeout(() => showToast(`AI successfully auto-planted ${plantedCount} companion plants!`), 0);
        return newGrid;
      });
      setIsPlanning(false);
    }, 1500); // Artificial delay to make it feel like AI is "thinking"
  };

  const emptySpots = gardenGrid.filter((c) => c === null).length;

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in relative">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">My Garden Map</h1>
          <p className="text-gray-600">Select a plant below, then click the grid to plant. Click existing plants to harvest.</p>
        </div>
        <button onClick={autoPlanGarden} disabled={isPlanning || emptySpots === 0} className="bg-[#6B8E23] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#55731b] transition-colors shadow-sm disabled:opacity-70 shrink-0">
          {isPlanning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} AI Auto-Plan
        </button>
      </header>

      {/* Top Carousel Palette showing all available plants in the library */}
      <div className="w-full overflow-x-auto py-2 shrink-0" style={{ scrollbarWidth: "thin" }}>
        <div className="flex flex-nowrap gap-4 px-1 pb-2">
          {libraryPlants.map((plant) => (
            <button key={plant.id} onClick={() => setSelectedPalettePlant(selectedPalettePlant?.id === plant.id ? null : plant)} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${selectedPalettePlant?.id === plant.id ? "bg-[#C86B52] text-white border-[#C86B52] shadow-md transform -translate-y-1" : "bg-white text-[#4A3B32] border-[#E2D9C8] hover:border-[#C86B52]"}`}>
              <img src={plant.imageUrl} alt={plant.name} className="w-6 h-6 rounded-full object-cover shadow-sm bg-white" />
              <span className="whitespace-nowrap">{plant.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* The main 50-cell grid */}
      <div className="flex-1 bg-white p-6 rounded-xl border border-[#E2D9C8] shadow-inner overflow-y-auto flex flex-col items-center justify-start md:justify-center relative mb-10">
        {emptySpots === 50 ? (
          <div className="text-center absolute inset-0 pointer-events-none opacity-50 flex flex-col items-center justify-center z-0">
            <Map size={48} className="text-gray-400 mb-4" />
            <p className="text-xl font-serif text-gray-500">Your garden is empty.</p>
            <p className="text-sm text-gray-400">Select a plant above to begin.</p>
          </div>
        ) : null}

        {/* CSS Grid dynamically spaces the cells based on screen width */}
        <div className="grid grid-cols-5 lg:grid-cols-10 gap-2 md:gap-3 w-full max-w-5xl min-w-[300px] relative z-10 mx-auto">
          {gardenGrid.map((cell, index) => (
            <div key={index} onClick={() => handleCellClick(index)} className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${cell ? "bg-[#F9F6F0] border-[#6B8E23]/30 hover:border-[#6B8E23] shadow-sm hover:shadow-md" : selectedPalettePlant ? "border-dashed border-[#E2D9C8] hover:border-[#C86B52] hover:bg-[#C86B52]/10 bg-transparent" : "border-dashed border-[#E2D9C8] bg-transparent opacity-50"}`}>
              {cell ? (
                <>
                  <img src={cell.imageUrl} alt={cell.name} className="w-8 h-8 md:w-12 md:h-12 rounded-full object-cover mb-1 shadow-sm bg-white" />
                  <span className="text-[10px] md:text-xs font-medium text-[#4A3B32] hidden md:block px-1 text-center leading-tight truncate w-full">{cell.name}</span>
                </>
              ) : (
                // Only show a hover indicator plus if they are actively trying to plant something
                selectedPalettePlant && <Plus className="text-[#C86B52] opacity-30" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Harvest Modal Overlay */}
      {harvestPlantIndex !== null && (
        <div className="fixed inset-0 bg-[#4A3B32]/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md relative animate-bounce-short">
            <button onClick={() => setHarvestPlantIndex(null)} className="absolute top-4 right-4 text-gray-400 hover:text-[#4A3B32]"><X size={24} /></button>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 inline-block transform hover:scale-110 transition-transform">🎉</div>
              <h2 className="text-3xl font-serif text-[#4A3B32] mb-2">Harvest Time!</h2>
              <p className="text-gray-600">Your <span className="font-bold text-[#C86B52]">{gardenGrid[harvestPlantIndex].name}</span> is ready.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record Yield Amount</label>
                <input type="text" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} placeholder="e.g., 2 baskets, 500g..." className="w-full p-3 rounded-xl border border-[#E2D9C8] focus:outline-none focus:border-[#C86B52] bg-[#F9F6F0]"/>
              </div>
              <button onClick={handleLogHarvest} className="w-full bg-[#C86B52] text-white py-3 rounded-xl font-medium shadow-md hover:bg-[#b05a43] transition-colors">Log Harvest & Keep Plant</button>
              <button onClick={handleRemovePlant} className="w-full bg-white text-[#C86B52] border border-[#C86B52] py-3 rounded-xl font-medium hover:bg-[#F9F6F0] transition-colors">Uproot / Remove Plant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Tools: The AI Command Center. Houses the Plant Advisor chatbot and Image Identification logic.
const Tools = ({ showToast, gardenGrid, setGardenGrid, libraryPlants, setLibraryPlants }) => {
  const [sunHours, setSunHours] = useState(6);
  
  // States specific to the Image Uploader functionality
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [uploadedImgData, setUploadedImgData] = useState(null);

  // States specific to the AI Text Chatbot functionality
  const [ailmentInput, setAilmentInput] = useState("");
  const [botResponse, setBotResponse] = useState(null);
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Utility to generate a safe SVG data URI for dynamically extracted AI plants.
  // We use encodeURIComponent instead of btoa() because btoa crashes when trying to encode emojis.
  const generatePlaceholderSVG = () => {
    const emojis = ["🌿", "🪴", "🌱", "🌺", "🌾", "🍀", "🌻"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#E2D9C8"/><text x="50%" y="50%" font-size="80" text-anchor="middle" dominant-baseline="central">${randomEmoji}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  // Triggered when user asks the chatbot a question
  const queryPlantAdvisor = async () => {
    if (!ailmentInput.trim()) return;
    setIsBotThinking(true);
    setBotResponse(null);

    const apiKey = "AIzaSyAq5WRABb6khNJkl5mZjcnxNT_cIFFirHU".trim();

    // Construct the payload required by Gemini API.
    // Crucially, we enforce a strict JSON responseSchema so the AI returns clean object data 
    // rather than a messy paragraph. This allows us to extract the individual plant items into our library.
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `Act as an expert Ayurvedic and natural plant advisor. The user says: "${ailmentInput}". Provide conversational advice, AND formulate an array of the specific plants, fruits, or flowers you recommend to help with this issue. Include deep details so we can add them to our database. Return ONLY a valid JSON object matching the schema. No markdown formatting.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            advice: { type: "STRING", description: "Your conversational, detailed advice." },
            suggestedPlants: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  type: { type: "STRING", description: "e.g., Herb, Succulent, Root, Flower" },
                  difficulty: { type: "STRING", description: "Easy, Moderate, or Hard" },
                  zone: { type: "STRING", description: "e.g., 3-11" },
                  light: { type: "STRING", description: "e.g., Full Sun, Part Sun" },
                  soil: { type: "STRING", description: "e.g., 6.0-7.0" },
                  healing: { type: "ARRAY", items: { type: "STRING" }, description: "Specific ailments it treats" },
                  description: { type: "STRING", description: "Short description of the plant." }
                },
                required: ["name", "type", "difficulty", "zone", "light", "soil", "healing", "description"]
              }
            }
          },
          required: ["advice", "suggestedPlants"]
        }
      }
    };

    try {
      // Look up what model the key supports, then make the API call with backoff
      const modelToUse = await discoverValidModel(apiKey);
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

      const result = await fetchWithBackoff(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Parse the response back into our application state
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        let textResponse = result.candidates[0].content.parts[0].text;
        
        // Strip markdown backticks in case Gemini disobeys instructions and wraps the JSON string in markdown codeblocks
        if (textResponse.startsWith("```")) {
           textResponse = textResponse.replace(/^```json/g, "").replace(/^```/g, "").replace(/```$/g, "").trim();
        }

        const parsed = JSON.parse(textResponse);
        
        // Failsafe in case Gemini forgets to include the array entirely
        if (!parsed.suggestedPlants) {
          parsed.suggestedPlants = [];
        }

        setBotResponse(parsed); // Updates UI to show advice and "Magic Extract" buttons
      } else {
        setBotResponse({ advice: "The AI was unable to generate a response for this query.", suggestedPlants: [] });
      }
    } catch (err) {
      console.error(err);
      setBotResponse({ advice: `Error loading AI response: ${err.message}. Please check API key permissions or try rephrasing.`, suggestedPlants: [] });
    }
    setIsBotThinking(false);
  };

  // Called when user clicks "Magic Extract" on an AI-suggested plant
  const handleMagicExtract = (plantData) => {
    const plantName = plantData.name || "Unknown Plant";
    
    // Safety check: Does this plant already exist in our dynamic library?
    if (libraryPlants.some(p => (p.name || "").toLowerCase() === plantName.toLowerCase())) {
       showToast(`${plantName} is already in your Library!`, true);
       return;
    }

    // Transform the raw AI output into our standard application plant object
    const newLibraryPlant = {
      ...plantData,
      name: plantName,
      id: `extracted-${Date.now()}`, // Generate a unique ID based on current timestamp
      imageUrl: generatePlaceholderSVG(),
      companion: []
    };

    // Push it into global library state (which will auto-sync to localStorage)
    setLibraryPlants([...libraryPlants, newLibraryPlant]);
    showToast(`Magic Extract successful! ${plantName} added to your Library.`);
  };

  // Triggers when a user selects a file from the hidden input element
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // Reset input so user can re-upload the exact same file if they want
    if (!file) return;

    setAnalyzingImage(true);
    setAnalysisResult(null);

    try {
      // We must read the physical file into a Base64 string so we can pass it through a JSON HTTP request
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64String = reader.result;
        setUploadedImgData(base64String); // Keep full string to show image preview in UI
        const base64DataOnly = base64String.split(",")[1]; // Strip "data:image/jpeg;base64," prefix for the Gemini payload

        const apiKey = "AIzaSyAq5WRABb6khNJkl5mZjcnxNT_cIFFirHU".trim();

        // Multimodal Payload structure: we pass both a text prompt and the raw image data object
        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Analyze this plant image and provide details on medicinal benefits and growth requirements in JSON format.",
                },
                { inlineData: { mimeType: file.type, data: base64DataOnly } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                status: { type: "STRING", description: "Either 'HEALTHY_PLANT', 'DISEASED_PLANT', or 'NOT_A_PLANT'" },
                plantName: { type: "STRING" },
                diseaseName: { type: "STRING" },
                healthBenefits: { type: "ARRAY", items: { type: "STRING" } },
                growthRequirements: {
                  type: "OBJECT",
                  properties: { light: { type: "STRING" }, soil: { type: "STRING" }, zone: { type: "STRING" } },
                },
                treatments: { type: "ARRAY", items: { type: "STRING" } },
                description: { type: "STRING" },
                type: { type: "STRING", description: "e.g., Herb, Succulent, Root" },
              },
            },
          },
        };

        try {
          const modelToUse = await discoverValidModel(apiKey);
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

          const result = await fetchWithBackoff(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          // Check if AI responded successfully and parse the returned JSON string
          if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            const parsedData = JSON.parse(result.candidates[0].content.parts[0].text);
            setAnalysisResult(parsedData); // Populate the UI result card
            if (parsedData.status === "NOT_A_PLANT") {
              showToast("Could not identify a plant in this image.", true);
            } else {
              showToast(`Successfully analyzed: ${parsedData.plantName}`);
            }
          } else {
            showToast("Failed to analyze image.", true);
          }
        } catch (fetchError) {
          showToast(`Network error: ${fetchError.message}`, true);
        }
        setAnalyzingImage(false);
      };
    } catch (error) {
      setAnalyzingImage(false);
    }
  };

  // Called when user decides to keep an AI-identified plant from their uploaded photo
  const handleAddToGarden = () => {
    if (!analysisResult || analysisResult.status === "NOT_A_PLANT") return;

    // Find the first available empty slot in the garden mapping
    const emptyIndex = gardenGrid.findIndex((cell) => cell === null);
    if (emptyIndex === -1) {
      showToast("Your garden map is full! Remove a plant first.", true);
      return;
    }

    const newPlant = {
      id: `ai-${Date.now()}`,
      name: analysisResult.plantName,
      type: analysisResult.type || "Herb",
      difficulty: "Moderate",
      zone: analysisResult.growthRequirements?.zone || "Unknown",
      light: analysisResult.growthRequirements?.light || "Unknown",
      soil: analysisResult.growthRequirements?.soil || "Unknown",
      healing: analysisResult.healthBenefits || [],
      imageUrl: uploadedImgData, // Keep using the photo they just uploaded!
      description: analysisResult.description || "AI Identified Plant",
    };

    const newGrid = [...gardenGrid];
    newGrid[emptyIndex] = newPlant;
    setGardenGrid(newGrid);
    showToast(`Successfully planted ${analysisResult.plantName} in your garden!`);
    
    // Clear out the uploader interface upon success
    setAnalysisResult(null);
    setUploadedImgData(null);
  };

  const getSunRecommendations = () => {
    if (sunHours >= 6) return libraryPlants.filter((p) => (p.light || "").includes("Full Sun"));
    if (sunHours >= 4) return libraryPlants.filter((p) => (p.light || "").includes("Part Sun"));
    return [];
  };

  return (
    <div className="space-y-8 animate-fade-in h-full overflow-y-auto pr-2 pb-10">
      <header>
        <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">Tools & Utilities</h1>
        <p className="text-gray-600">Smart calculators and AI to perfect your medicinal garden.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <ThermometerSun className="text-[#C86B52]" size={28} />
              <h2 className="text-2xl font-serif text-[#4A3B32]">Solar Exposure Calculator</h2>
            </div>
            <p className="text-gray-600 mb-6 text-sm">Determine which plants will thrive based on hours of direct sunlight.</p>
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">Hours of Direct Sunlight: <span className="text-[#C86B52] font-bold">{sunHours}h</span></label>
              <input type="range" min="0" max="12" step="1" value={sunHours} onChange={(e) => setSunHours(Number(e.target.value))} className="w-full accent-[#C86B52] bg-[#E2D9C8] h-2 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <h3 className="font-medium text-[#4A3B32] mb-3 border-b border-[#E2D9C8] pb-2">Recommended Library Plants</h3>
              <div className="flex flex-wrap gap-2">
                {getSunRecommendations().map((p) => (
                  <span key={p.id} className="bg-[#F9F6F0] border border-[#E2D9C8] text-[#4A3B32] px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                    <Leaf size={14} className="text-[#6B8E23]" /> {p.name}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Chatbot Interface */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="text-[#C86B52]" size={28} />
              <h2 className="text-2xl font-serif text-[#4A3B32]">AI Plant Advisor</h2>
            </div>
            <textarea
              value={ailmentInput}
              onChange={(e) => setAilmentInput(e.target.value)}
              placeholder="e.g., I have skin itches and rashes..."
              className="w-full p-3 rounded-xl border border-[#E2D9C8] focus:outline-none focus:border-[#C86B52] bg-[#F9F6F0] mb-4 min-h-[100px]"
            />
            <button
              onClick={queryPlantAdvisor}
              disabled={isBotThinking || !ailmentInput.trim()}
              className="w-full bg-[#6B8E23] text-white py-3 rounded-xl font-medium shadow-md hover:bg-[#55731b] transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isBotThinking ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Ask Advisor
            </button>

            {botResponse && (
              <div className="mt-6 p-4 bg-white rounded-xl border border-[#E2D9C8] text-sm text-gray-700 leading-relaxed max-h-[400px] overflow-y-auto">
                <p className="whitespace-pre-wrap mb-4 text-base">{botResponse.advice || "No advice provided."}</p>
                {botResponse.suggestedPlants && botResponse.suggestedPlants.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h4 className="font-bold text-[#4A3B32] uppercase tracking-wider text-xs border-b border-[#E2D9C8] pb-1">AI Library Suggestions</h4>
                    {botResponse.suggestedPlants.map((plantData, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-[#F9F6F0] rounded-lg border border-[#E2D9C8] gap-3 shadow-sm">
                        <div>
                          <span className="font-bold text-[#C86B52] block text-base">{plantData.name}</span>
                          <span className="text-xs text-gray-500 font-medium">Treats: {plantData.healing?.join(", ")}</span>
                        </div>
                        <button onClick={() => handleMagicExtract(plantData)} className="bg-[#4A3B32] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#C86B52] transition-colors shrink-0 shadow flex items-center justify-center gap-1">
                          <Plus size={14}/> Magic Extract
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 flex flex-col items-center justify-center border-dashed border-2 border-[#C86B52]/40 bg-[#F9F6F0]">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm overflow-hidden">
              {analyzingImage ? <Loader2 size={32} className="animate-spin text-[#C86B52]" /> : uploadedImgData ? <img src={uploadedImgData} alt="Uploaded" className="w-full h-full object-cover" /> : <Camera size={32} className="text-[#C86B52]" />}
            </div>
            <h2 className="text-2xl font-serif text-[#4A3B32] mb-2 text-center">AI Plant & Disease ID</h2>
            <label className="bg-[#4A3B32] text-white px-6 py-3 rounded-xl shadow-md hover:bg-[#382c25] transition-colors cursor-pointer flex items-center gap-2">
              <ImageIcon size={18} /> {analyzingImage ? "Analyzing..." : "Upload Photo"}
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </Card>

          {analysisResult && analysisResult.status !== "NOT_A_PLANT" && (
            <Card className={`p-6 border-l-4 animate-fade-in ${analysisResult.status === "DISEASED_PLANT" ? "border-l-red-500" : "border-l-[#6B8E23]"}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-serif text-[#4A3B32]">{analysisResult.plantName}</h3>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold mt-1 ${analysisResult.status === "DISEASED_PLANT" ? "bg-red-100 text-red-700" : "bg-[#6B8E23]/20 text-[#6B8E23]"}`}>
                    {analysisResult.status === "DISEASED_PLANT" ? "⚠️ DISEASE DETECTED" : "✓ HEALTHY"}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-4">{analysisResult.description}</p>

              {analysisResult.status === "DISEASED_PLANT" && analysisResult.diseaseName && (
                <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100">
                  <h4 className="font-bold text-red-800 text-sm mb-2">Disease: {analysisResult.diseaseName}</h4>
                  <ul className="space-y-1">
                    {analysisResult.treatments?.map((t, i) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-1"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Medicinal Benefits</h4>
                  <ul className="space-y-1">
                    {analysisResult.healthBenefits?.slice(0, 3).map((h, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-center gap-1"><Heart size={12} className="text-[#C86B52]" /> {h}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Requirements</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p className="flex items-center gap-1"><Sun size={12} className="text-yellow-600" /> {analysisResult.growthRequirements?.light}</p>
                    <p className="flex items-center gap-1"><Droplets size={12} className="text-blue-500" /> {analysisResult.growthRequirements?.soil}</p>
                  </div>
                </div>
              </div>

              <button onClick={handleAddToGarden} className="w-full bg-[#6B8E23] text-white py-3 rounded-xl font-medium shadow-md hover:bg-[#55731b] transition-colors flex justify-center items-center gap-2">
                <Plus size={18} /> Add to Garden Map
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// SeedSwap: A mock UI view showing how social features could integrate into the platform.
const SeedSwap = ({ showToast }) => (
  <div className="space-y-6 animate-fade-in h-full overflow-y-auto pr-2 pb-10">
    <header className="flex justify-between items-end mb-8">
      <div>
        <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">Community Seed Swap</h1>
        <p className="text-gray-600">Connect with local herbalists to trade medicinal seeds.</p>
      </div>
      <button onClick={() => showToast("Listing created!")} className="bg-[#6B8E23] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#55731b] transition-colors shadow-sm">
        <Plus size={18} /> List My Seeds
      </button>
    </header>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[
        { name: "Ashwagandha Seeds", user: "Sarah M.", location: "Portland, OR", wants: "Holy Basil" },
        { name: "Organic Calendula", user: "GreenThumb99", location: "Austin, TX", wants: "Any adaptogens" },
        { name: "Echinacea Purpurea", user: "David Roots", location: "Denver, CO", wants: "Lemon Balm" },
      ].map((listing, i) => (
        <Card key={i} className="p-5 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-[#F9F6F0] p-3 rounded-xl"><Sprout className="text-[#6B8E23]" size={24} /></div>
            <span className="text-xs bg-[#E2D9C8] text-[#4A3B32] px-2 py-1 rounded-full font-medium">{listing.location}</span>
          </div>
          <h3 className="font-serif text-xl text-[#4A3B32] mb-1">{listing.name}</h3>
          <p className="text-sm text-gray-500 mb-4 flex items-center gap-1"><Users size={14} /> {listing.user}</p>
          <div className="mt-auto pt-4 border-t border-[#E2D9C8]">
            <p className="text-sm text-gray-600"><span className="font-medium">Seeking:</span> {listing.wants}</p>
            <button onClick={() => showToast("Message sent to " + listing.user)} className="mt-4 w-full bg-white border border-[#C86B52] text-[#C86B52] py-2 rounded-lg text-sm font-medium hover:bg-[#F9F6F0] transition-colors">
              Offer Trade
            </button>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

// Apothecary: Matches plants actively growing in the Garden Map to specific ailments.
const Apothecary = ({ gardenGrid }) => {
  const [selectedAilment, setSelectedAilment] = useState("");

  const ailments = [
    "Burns", "Skin Care", "Digestion", "Headaches", "Memory", "Focus", "Stress relief",
    "Inflammation", "Nausea", "Immunity", "Blood Pressure", "Coughs", "Sore Throat", "Anxiety", "Sleep",
  ];

  // We only look at non-empty grid cells
  const grownPlants = gardenGrid.filter((p) => p !== null);
  
  // Find which of our currently growing plants contain the selected ailment in their 'healing' array.
  // Using 'Set' removes any duplicate plant names from the final list.
  const matchingGrownPlants = Array.from(new Set(grownPlants.filter((p) => p.healing && p.healing.includes(selectedAilment)).map((p) => p.name)));

  return (
    <div className="space-y-6 h-full animate-fade-in pr-2 pb-10 overflow-y-auto">
      <header>
        <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">The Apothecary</h1>
        <p className="text-gray-600">Formulate natural remedies directly from your garden harvest.</p>
      </header>

      <Card className="p-6">
        <h2 className="text-xl font-serif text-[#4A3B32] mb-4">What would you like to treat?</h2>
        <select value={selectedAilment} onChange={(e) => setSelectedAilment(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2D9C8] focus:outline-none focus:border-[#C86B52] bg-white mb-6 text-[#4A3B32]">
          <option value="">Select an ailment...</option>
          {ailments.map((a) => (<option key={a} value={a}>{a}</option>))}
        </select>

        {selectedAilment && (
          <div className="bg-[#F9F6F0] p-4 rounded-xl border border-[#E2D9C8] animate-fade-in">
            <h3 className="font-medium text-[#4A3B32] mb-3">Available plants in your garden for {selectedAilment}:</h3>
            {matchingGrownPlants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {matchingGrownPlants.map((plantName) => (
                  <span key={plantName} className="bg-[#C86B52] text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 shadow-sm">
                    <Leaf size={14} /> {plantName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 bg-white p-3 rounded-lg border border-dashed border-[#E2D9C8]">
                You don't have any plants growing right now that treat this ailment. Visit the Plant Library to find new seeds!
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-[#F9F6F0] rounded-full flex items-center justify-center mb-4"><Wind className="text-[#6B8E23]" size={24} /></div>
          <h3 className="text-xl font-serif text-[#4A3B32] mb-2">Basic Herbal Tea</h3>
          <p className="text-sm text-gray-600 mb-4">A gentle extraction method for leaves and flowers.</p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Harvest 1 tsp dried or 1 tbsp fresh herb.</li>
            <li>Boil 1 cup of water.</li>
            <li>Pour water over herbs and cover.</li>
            <li>Steep for 5-10 minutes.</li>
            <li>Strain and enjoy immediately.</li>
          </ol>
        </Card>
        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-[#F9F6F0] rounded-full flex items-center justify-center mb-4"><Droplets className="text-[#C86B52]" size={24} /></div>
          <h3 className="text-xl font-serif text-[#4A3B32] mb-2">Healing Salve</h3>
          <p className="text-sm text-gray-600 mb-4">For topical applications on skin irritations and burns.</p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Infuse carrier oil with dried herbs for 4 weeks.</li>
            <li>Carefully strain the oil through cheesecloth.</li>
            <li>Melt 1 part beeswax with 4 parts infused oil.</li>
            <li>Pour into clean tins and let cool until hardened.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

// PestGuide: Static reference view for organic gardening principles.
const PestGuide = () => {
  const pests = [
    { name: "Aphids", signs: "Curled, yellowing leaves. Sticky residue (honeydew) on stems.", treatment: "Spray with neem oil or insecticidal soap. Introduce ladybugs to your garden." },
    { name: "Spider Mites", signs: "Tiny yellow or white speckles on leaves. Fine, dusty webbing under leaves.", treatment: "Wipe leaves with a damp cloth. Increase humidity. Use a neem oil spray." },
    { name: "Powdery Mildew", signs: "White powdery spots spreading on leaves and stems.", treatment: "Improve air circulation. Spray with a mixture of baking soda, mild liquid soap, and water." },
    { name: "Fungus Gnats", signs: "Tiny black flies near soil surface. Larvae cause root damage.", treatment: "Allow top 2 inches of soil to dry completely between waterings. Use yellow sticky traps." },
  ];

  return (
    <div className="space-y-6 h-full animate-fade-in pr-2 pb-10 overflow-y-auto">
      <header>
        <h1 className="text-4xl font-serif text-[#4A3B32] mb-2">Natural Pest Guide</h1>
        <p className="text-gray-600">Organic, non-toxic solutions to keep your medicinal plants healthy.</p>
      </header>
      <div className="grid md:grid-cols-2 gap-6">
        {pests.map((pest) => (
          <Card key={pest.name} className="p-6 hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#F9F6F0] p-3 rounded-full shadow-inner"><Bug className="text-[#C86B52]" size={24} /></div>
              <h2 className="text-2xl font-serif text-[#4A3B32]">{pest.name}</h2>
            </div>
            <div className="space-y-4">
              <div><h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Signs & Symptoms</h3><p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{pest.signs}</p></div>
              <div><h3 className="text-xs uppercase tracking-wider text-[#6B8E23] font-bold mb-2">Organic Treatment</h3><p className="text-sm text-gray-800 bg-[#6B8E23]/10 p-3 rounded-lg border border-[#6B8E23]/20">{pest.treatment}</p></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- APP COMPONENT: The root container managing all global state and navigation ---

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");

  // --- STATE MANAGEMENT WITH LOCAL STORAGE ---
  // We use lazy initialization for our state variables (passing an arrow function to useState).
  // This ensures we only read from localStorage during the very first render, rather than on every re-render,
  // which keeps the app highly performant.

  const [libraryPlants, setLibraryPlants] = useState(() => {
    try {
      const saved = localStorage.getItem("gardenGuide_library");
      // If we find saved library data in the browser memory, parse it back into a JavaScript array.
      // Otherwise, return our fallback INITIAL_PLANTS list.
      return saved ? JSON.parse(saved) : INITIAL_PLANTS;
    } catch (e) {
      return INITIAL_PLANTS;
    }
  });

  const [gardenGrid, setGardenGrid] = useState(() => {
    try {
      const saved = localStorage.getItem("gardenGuide_gardenGrid");
      if (saved) {
        const parsed = JSON.parse(saved);
        // We create a fresh 50-cell grid to populate to handle any legacy formatting issues
        const expandedGrid = Array(50).fill(null);
        parsed.forEach((item, index) => {
          if (index < 50 && item) {
            // Re-hydrate the plant object from the live library to ensure properties stay up to date
            const updatedPlant = libraryPlants.find((p) => p.id === item.id) || item;
            expandedGrid[index] = updatedPlant || null;
          }
        });
        return expandedGrid;
      }
      return Array(50).fill(null); // Fallback: 50 empty dirt patches
    } catch (e) {
      return Array(50).fill(null);
    }
  });

  const [journalEntries, setJournalEntries] = useState(() => {
    try {
      const saved = localStorage.getItem("gardenGuide_journalEntries");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("gardenGuide_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const toggleFavorite = (id) => {
    setFavorites((prev) => prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]);
  };

  // --- DATA SYNCHRONIZATION ---
  // `useEffect` hooks watch for changes. Whenever libraryPlants, gardenGrid, etc. are modified by the user,
  // these hooks trigger and automatically overwrite the older values in the browser's localStorage.
  useEffect(() => { localStorage.setItem("gardenGuide_library", JSON.stringify(libraryPlants)); }, [libraryPlants]);
  useEffect(() => { localStorage.setItem("gardenGuide_gardenGrid", JSON.stringify(gardenGrid)); }, [gardenGrid]);
  useEffect(() => { localStorage.setItem("gardenGuide_journalEntries", JSON.stringify(journalEntries)); }, [journalEntries]);
  useEffect(() => { localStorage.setItem("gardenGuide_favorites", JSON.stringify(favorites)); }, [favorites]);

  // UI Control states
  const [drawerPlant, setDrawerPlant] = useState(null); // Controls the sliding side panel
  const [toastMessage, setToastMessage] = useState(null);
  const [isToastError, setIsToastError] = useState(false);

  // Helper to trigger popup notifications and hide them after 4 seconds
  const showToast = (msg, isError = false) => {
    setToastMessage(msg);
    setIsToastError(isError);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Navigation configuration array
  const navItems = [
    { id: "dashboard", icon: Home, label: "Dashboard" },
    { id: "garden", icon: Map, label: "My Garden" },
    { id: "library", icon: BookOpen, label: "Plant Library" },
    { id: "apothecary", icon: Heart, label: "The Apothecary" },
    { id: "pests", icon: Bug, label: "Pest Guide" },
    { id: "tools", icon: Search, label: "Tools & AI" },
    { id: "seeds", icon: Users, label: "Seed Swap" },
  ];

  return (
    <div className="flex h-screen bg-[#F9F6F0] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 md:w-64 bg-[#4A3B32] text-[#E2D9C8] flex flex-col shadow-xl z-40">
        <div className="p-6 flex items-center gap-3">
          <Leaf className="text-[#C86B52]" size={32} />
          <h1 className="font-serif text-2xl text-white hidden md:block">Apothecary</h1>
        </div>
        <ul className="flex-1 px-4 space-y-2 mt-8">
          {navItems.map((item) => (
            <li key={item.id}>
              {/* Button conditionally changes background color if it represents the currently active view */}
              <button onClick={() => setCurrentView(item.id)} className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${currentView === item.id ? "bg-[#C86B52] text-white shadow-lg" : "hover:bg-[#604E42]"}`}>
                <item.icon size={22} className="shrink-0" />
                <span className="hidden md:block font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main View Area: Render the corresponding component based on `currentView` state */}
      <main className="flex-1 relative overflow-hidden flex flex-col p-6 md:p-10">
        <div className="max-w-6xl mx-auto w-full h-full relative">
          {currentView === "dashboard" && <Dashboard setCurrentView={setCurrentView} gardenGrid={gardenGrid} journalEntries={journalEntries} />}
          {currentView === "library" && <Library setDrawerPlant={setDrawerPlant} favorites={favorites} toggleFavorite={toggleFavorite} libraryPlants={libraryPlants} />}
          {currentView === "garden" && <Garden gardenGrid={gardenGrid} setGardenGrid={setGardenGrid} showToast={showToast} journalEntries={journalEntries} setJournalEntries={setJournalEntries} libraryPlants={libraryPlants} />}
          {currentView === "apothecary" && <Apothecary gardenGrid={gardenGrid} />}
          {currentView === "pests" && <PestGuide />}
          {currentView === "tools" && <Tools showToast={showToast} gardenGrid={gardenGrid} setGardenGrid={setGardenGrid} libraryPlants={libraryPlants} setLibraryPlants={setLibraryPlants} />}
          {currentView === "seeds" && <SeedSwap showToast={showToast} />}
        </div>
      </main>

      {/* Slide-out Plant Information Drawer */}
      {/* If drawerPlant is not null, we render this full screen overlay and sliding side panel */}
      {drawerPlant && (
        <>
          {/* Dark, blurred background overlay. Clicking it sets drawerPlant back to null, closing the modal. */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in" onClick={() => setDrawerPlant(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-[400px] bg-white z-50 shadow-2xl animate-slide-in-right flex flex-col">
            <div className="h-64 bg-[#E2D9C8] relative flex items-center justify-center overflow-hidden shrink-0">
              <img src={drawerPlant.imageUrl} alt={drawerPlant.name} className="w-full h-full object-cover" />
              <button onClick={() => setDrawerPlant(null)} className="absolute top-4 right-4 bg-white/50 p-2 rounded-full hover:bg-white text-[#4A3B32] shadow-sm"><X size={20} /></button>
              <div className={`absolute bottom-4 left-4 px-3 py-1.5 rounded shadow text-xs font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm ${drawerPlant.difficulty === "Easy" ? "text-[#6B8E23]" : "text-[#C86B52]"}`}>{drawerPlant.difficulty} to Grow</div>
              <button onClick={(e) => { e.stopPropagation(); toggleFavorite(drawerPlant.id); }} className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors shadow-sm">
                <Heart size={22} className={favorites.includes(drawerPlant.id) ? "fill-[#C86B52] text-[#C86B52]" : "text-white"} />
              </button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto">
              <h2 className="text-3xl font-serif text-[#4A3B32] mb-2">{drawerPlant.name}</h2>
              <p className="text-[#C86B52] font-medium mb-6">{drawerPlant.type} • Zone {drawerPlant.zone}</p>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-2">Growth Requirements</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-[#F9F6F0] p-3 rounded-lg"><Sun size={16} className="mb-1 text-[#C86B52]" /> {drawerPlant.light}</div>
                    <div className="bg-[#F9F6F0] p-3 rounded-lg"><Droplets size={16} className="mb-1 text-[#6B8E23]" /> pH: {drawerPlant.soil}</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-2">Healing Properties</h4>
                  <div className="flex flex-wrap gap-2">
                    {drawerPlant.healing && drawerPlant.healing.map((h, i) => (<span key={i} className="bg-[#E2D9C8]/50 px-3 py-1 rounded-full text-sm text-[#4A3B32]">{h}</span>))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-2">About</h4>
                  <p className="text-gray-700 leading-relaxed">{drawerPlant.description}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#E2D9C8] shrink-0 bg-white">
              <button onClick={() => { setCurrentView("garden"); setDrawerPlant(null); showToast(`Select a spot in your garden for ${drawerPlant.name}`); }} className="w-full bg-[#4A3B32] text-white py-4 rounded-xl font-medium shadow-md hover:bg-[#382c25] transition-colors flex items-center justify-center gap-2">
                <Plus size={20} /> Quick Add to Garden Map
              </button>
            </div>
          </div>
        </>
      )}

      {/* Renders global alert messages on top of the app UI */}
      <Toast message={toastMessage} isError={isToastError} />
    </div>
  );
}