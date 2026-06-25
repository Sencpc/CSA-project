import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../../config/env.js";

const useBackendHealth = () => {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const startTime = Date.now();
    const minimumLoadTime = 500;

    const checkBackend = async () => {
      try {
        // Try to connect to backend health endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        // Use absolute URL if API_BASE_URL is set, otherwise use relative path
        const healthUrl = API_BASE_URL ? `${API_BASE_URL}/health` : "/health";

        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          // Calculate remaining time to meet minimum load time
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minimumLoadTime - elapsedTime);

          // Wait for remaining time before hiding loading screen
          setTimeout(() => {
            setIsBackendReady(true);
          }, remainingTime);
        } else {
          // Backend responded but not healthy, retry after delay
          setTimeout(checkBackend, 2000);
        }
      } catch (error) {
        console.log("Backend not ready yet, retrying...", error.message);
        // Backend not available, retry after delay
        setTimeout(checkBackend, 2000);
      } finally {
        setIsChecking(false);
      }
    };

    checkBackend();
  }, []);

  return { isBackendReady, isChecking };
};

export default useBackendHealth;
