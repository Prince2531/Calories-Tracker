import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  FaFire,
  FaAppleAlt,
  FaHamburger,
  FaChartLine,
  FaPlus,
  FaSearch,
  FaTimes,
  FaBolt,
  FaRobot,
  FaPaperPlane,
  FaUser,
  FaStar,
  FaQuoteLeft,
} from "react-icons/fa";
import { GiMeal, GiWeightScale } from "react-icons/gi";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(
  import.meta.env.VITE_REACT_APP_GEMINI_API_KEY
);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const App = () => {
  // Calorie Tracker State
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [meals, setMeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [dailyGoal] = useState(2000);
  const [searchResults, setSearchResults] = useState([]);

  // AI Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI Nutrition Assistant. Ask me about calories, macros, or meal plans!",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Food Database
  const foodDatabase = [
    { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { name: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15 },
    { name: "Brown Rice", calories: 215, protein: 5, carbs: 45, fat: 1.8 },
    { name: "Salmon Fillet", calories: 208, protein: 20, carbs: 0, fat: 13 },
    { name: "Broccoli", calories: 55, protein: 3.7, carbs: 11, fat: 0.6 },
    { name: "Eggs", calories: 143, protein: 13, carbs: 0.7, fat: 9.5 },
    { name: "Sweet Potato", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
    { name: "Greek Yogurt", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  ];

  // Chart Refs
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);

  // Chart Data
  const macroData = {
    labels: ["Protein", "Carbs", "Fat"],
    datasets: [
      {
        data: [protein, carbs, fat],
        backgroundColor: [
          "rgba(45, 212, 191, 0.7)", // Teal
          "rgba(251, 191, 36, 0.7)", // Amber
          "rgba(245, 158, 11, 0.7)", // Darker Amber
        ],
        borderColor: [
          "rgba(45, 212, 191, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(245, 158, 11, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const calorieData = {
    labels: ["Consumed", "Remaining"],
    datasets: [
      {
        data: [calories, Math.max(0, dailyGoal - calories)],
        backgroundColor: [
          "rgba(251, 191, 36, 0.7)", // Amber
          "rgba(75, 85, 99, 0.5)", // Gray
        ],
        borderColor: ["rgba(251, 191, 36, 1)", "rgba(75, 85, 99, 1)"],
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  // Chart Options
  const pieOptions = {
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "#E5E7EB",
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.label}: ${context.raw}g`;
          },
        },
      },
    },
    cutout: "65%",
    maintainAspectRatio: false,
  };

  const barOptions = {
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.label}: ${context.raw} kcal`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#E5E7EB",
        },
      },
      y: {
        beginAtZero: true,
        max: dailyGoal,
        grid: {
          color: "rgba(75, 85, 99, 0.3)",
        },
        ticks: {
          color: "#E5E7EB",
          callback: (value) => `${value}kcal`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  // Search for food
  const handleSearch = () => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    const results = foodDatabase.filter((food) =>
      food.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(results);
  };

  // Add Meal to Log
  const addMeal = (food) => {
    setMeals([...meals, food]);
    setCalories(calories + food.calories);
    setProtein(protein + food.protein);
    setCarbs(carbs + food.carbs);
    setFat(fat + food.fat);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Reset Daily Log
  const resetDay = () => {
    setCalories(0);
    setProtein(0);
    setCarbs(0);
    setFat(0);
    setMeals([]);
  };

  // AI Chatbot Functions
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
    };
    setMessages([...messages, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const botResponse = await getGeminiResponse(inputValue);
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 2, text: botResponse, sender: "bot" },
      ]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 2,
          text: "Sorry, I couldn't process that. Try again!",
          sender: "bot",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getGeminiResponse = async (query) => {
    const prompt = `You are a nutrition expert. Provide concise, accurate answers about:
    - Calorie counts
    - Macronutrient breakdowns (protein, carbs, fat)
    - Healthy meal suggestions
    - Weight loss/gain tips
    
    User Question: ${query}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Header */}
      <header className="bg-gray-800 bg-opacity-80 backdrop-blur-md p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaFire className="text-amber-400" /> Calorie
            <span className="text-teal-300">Tracker</span>
          </h1>
          <button
            onClick={() => setShowSearch(true)}
            className="bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
          >
            <FaPlus /> Add Food
          </button>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="container mx-auto p-4">
        {/* Daily Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-teal-500 border-opacity-30"
            whileHover={{ scale: 1.02 }}
          >
            <h3 className="text-gray-400 flex items-center gap-2">
              <FaFire /> Calories
            </h3>
            <p className="text-3xl font-bold">
              {calories}{" "}
              <span className="text-sm text-gray-400">/ {dailyGoal}</span>
            </p>
            <div className="w-full bg-gray-700 h-2 rounded-full mt-2">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                initial={{ width: "0%" }}
                animate={{
                  width: `${Math.min((calories / dailyGoal) * 100, 100)}%`,
                }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </motion.div>

          <motion.div
            className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-teal-500 border-opacity-30"
            whileHover={{ scale: 1.02 }}
          >
            <h3 className="text-gray-400 flex items-center gap-2">
              <FaBolt /> Protein
            </h3>
            <p className="text-3xl font-bold text-teal-300">
              {parseInt(protein)}g
            </p>
          </motion.div>

          <motion.div
            className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-teal-500 border-opacity-30"
            whileHover={{ scale: 1.02 }}
          >
            <h3 className="text-gray-400 flex items-center gap-2">
              <FaAppleAlt /> Carbs
            </h3>
            <p className="text-3xl font-bold text-amber-300">{carbs}g</p>
          </motion.div>

          <motion.div
            className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-teal-500 border-opacity-30"
            whileHover={{ scale: 1.02 }}
          >
            <h3 className="text-gray-400 flex items-center gap-2">
              <FaHamburger /> Fat
            </h3>
            <p className="text-3xl font-bold text-amber-500">
              {parseInt(fat)}g
            </p>
          </motion.div>
        </div>

        {/* Meal Log */}
        <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 border border-teal-500 border-opacity-30 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <GiMeal /> Today's Meals
            </h2>
            <button
              onClick={resetDay}
              className="text-gray-400 hover:text-amber-400 transition-colors"
            >
              Reset Day
            </button>
          </div>

          {meals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No meals logged yet. Add some food!
            </p>
          ) : (
            <div className="space-y-3">
              {meals.map((meal, index) => (
                <motion.div
                  key={index}
                  className="bg-gray-700 bg-opacity-50 p-3 rounded-lg flex justify-between items-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div>
                    <p className="font-medium">{meal.name}</p>
                    <p className="text-sm text-gray-400">
                      {meal.calories} cal | P: {meal.protein}g | C: {meal.carbs}
                      g | F: {meal.fat}g
                    </p>
                  </div>
                  <button
                    className="text-gray-400 hover:text-amber-400"
                    onClick={() => {
                      setCalories(calories - meal.calories);
                      setProtein(protein - meal.protein);
                      setCarbs(carbs - meal.carbs);
                      setFat(fat - meal.fat);
                      setMeals(meals.filter((_, i) => i !== index));
                    }}
                  >
                    <FaTimes />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Nutrition Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 border border-teal-500 border-opacity-30">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <FaChartLine /> Macronutrients
            </h2>
            <div className="h-64">
              <Pie ref={pieChartRef} data={macroData} options={pieOptions} />
            </div>
          </div>

          <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 border border-teal-500 border-opacity-30">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <FaFire /> Calorie Progress
            </h2>
            <div className="h-64">
              <Bar ref={barChartRef} data={calorieData} options={barOptions} />
            </div>
          </div>
        </div>
      </main>

      {/* Food Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-800 bg-opacity-90 backdrop-blur-md rounded-xl w-full max-w-md p-6 border border-teal-500 border-opacity-50"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Add Food</h2>
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-amber-400"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch();
                  }}
                  placeholder="Search for food..."
                  className="w-full bg-gray-700 rounded-lg px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
              </div>

              <div className="max-h-96 overflow-y-auto">
                {searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((food, index) => (
                      <motion.div
                        key={index}
                        className="bg-gray-700 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-gray-600 transition-colors"
                        onClick={() => addMeal(food)}
                        whileHover={{ x: 5 }}
                      >
                        <div>
                          <p className="font-medium">{food.name}</p>
                          <p className="text-sm text-gray-400">
                            {food.calories} cal | P: {food.protein}g | C:{" "}
                            {food.carbs}g | F: {food.fat}g
                          </p>
                        </div>
                        <FaPlus className="text-teal-400" />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    {searchQuery
                      ? "No results found"
                      : "Search for food to log"}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Chatbot */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            className="fixed bottom-24 right-6 w-80 h-[500px] bg-gray-800 rounded-xl shadow-xl border border-teal-500 flex flex-col z-50"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", damping: 25 }}
          >
            <div className="bg-gradient-to-r from-teal-600 to-amber-600 p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <FaRobot /> Nutrition Assistant
              </h3>
              <button
                onClick={() => setIsChatOpen(false)}
                className="hover:opacity-80"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    message.sender === "user"
                      ? "bg-teal-600 ml-auto rounded-br-none"
                      : "bg-gray-700 mr-auto rounded-bl-none"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {message.text}
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  className="max-w-[80%] p-3 bg-gray-700 rounded-lg rounded-bl-none mr-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 bg-teal-400 rounded-full"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.3,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="p-4 border-t border-gray-700">
              <div className="flex bg-gray-700 rounded-full overflow-hidden">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask about nutrition..."
                  className="flex-1 px-4 py-2 bg-transparent outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading}
                  className="px-4 bg-teal-600 hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-teal-600 to-amber-600 shadow-lg flex items-center justify-center text-white z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <FaRobot className="text-xl" />
      </motion.button>
    </div>
  );
};

export default App;
