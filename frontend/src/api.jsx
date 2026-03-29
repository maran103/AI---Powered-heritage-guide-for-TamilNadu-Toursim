import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

// Get user ID from localStorage
const getUserId = () => {
  return localStorage.getItem("heritage_user_id");
};

// Get headers with user authentication
const getHeaders = () => {
  const userId = getUserId();
  return {
    "Content-Type": "application/json",
    "user-id": userId || ""
  };
};

export const askAI = async ({ message, latitude, longitude, language = "en", image_base64 = null, storytelling = false }, onStreamChunk) => {
  try {
    const userId = getUserId();
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-id": userId || ""
      },
      body: JSON.stringify({
        message,
        latitude,
        longitude,
        language,
        image_base64,
        storytelling
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        return "Please login to use the chat feature.";
      }
      return "Sorry, I couldn't connect to the server. Please make sure the backend is running.";
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              // Call callback with streamed chunk
              if (onStreamChunk) {
                onStreamChunk(data.text);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return fullText;
  } catch (error) {
    console.error("API Error:", error);
    return "Sorry, I encountered an error. Please try again.";
  }
};

export const getChatHistory = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/chat/history`, {
      headers: getHeaders()
    });

    return response.data.messages || [];
  } catch (error) {
    console.error("Error loading chat history:", error);
    return [];
  }
};

export const clearChatHistory = async () => {
  try {
    await axios.delete(`${API_BASE_URL}/chat/history`, {
      headers: getHeaders()
    });

    return true;
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return false;
  }
};

export const getFestivals = async (lat, lng) => {
  try {
    const params = lat && lng ? { lat, lng } : {};
    const response = await axios.get(`${API_BASE_URL}/heritage/festivals`, { params });
    return response.data;
  } catch (error) {
    console.error("Error loading festivals:", error);
    return [];
  }
};

export const getHeritageSites = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/heritage/sites`);
    return response.data || [];
  } catch (error) {
    console.error("Error loading heritage sites:", error);
    return [];
  }
};

export const getTTSAudioUrl = (text, lang) => {
  return `${API_BASE_URL}/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
};

export const addVisitedPlace = async (siteName) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/user/visit`, { site_name: siteName }, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    console.error("Error adding visited place:", error);
    return null;
  }
};

export const removeVisitedPlace = async (siteName) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/user/visit`, {
      data: { site_name: siteName },
      params: { site_name: siteName }, // Fallback for some axios versions
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Error removing visited place:", error);
    return null;
  }
};

export const getVisitedPlaces = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/visited`, { headers: getHeaders() });
    return response.data.visited_places || [];
  } catch (error) {
    console.error("Error fetching visited places:", error);
    return [];
  }
};
export const changePassword = async (old_password, new_password) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/auth/password`, {
      old_password,
      new_password
    }, {
      headers: getHeaders()
    });

    return { success: true, message: response.data.message };
  } catch (error) {
    console.error("Error changing password:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Error changing password"
    };
  }
};

export const deleteAccount = async () => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/auth/account`, {
      headers: getHeaders()
    });

    return { success: true, message: response.data.message };
  } catch (error) {
    console.error("Error deleting account:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Error deleting account"
    };
  }
};
