import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
  ];

  const ROBLOX_DOMAINS = [
    'users.roblox.com',
    'thumbnails.roblox.com',
    'www.roblox.com',
    'groups.roblox.com',
    'economy.roblox.com',
    'inventory.roblox.com',
    'api.roblox.com',
    'roblox.com'
  ];

  const getProxyUrl = (url: string) => {
    let proxiedUrl = url;
    for (const domain of ROBLOX_DOMAINS) {
      if (proxiedUrl.includes(domain)) {
        proxiedUrl = proxiedUrl.replace(domain, domain.replace('roblox.com', 'roproxy.com'));
        break;
      }
    }
    return proxiedUrl;
  };

  const getHeaders = () => {
    return {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.roblox.com',
      'Referer': 'https://www.roblox.com/',
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest'
    };
  };

  const fetchWithRetry = async (url: string, options: any, timeout = 3000): Promise<Response | null> => {
    // Try RoProxy first (Primary)
    try {
      const proxyUrl = getProxyUrl(url);
      const res = await fetch(proxyUrl, { 
        ...options, 
        headers: { ...getHeaders(), ...(options.headers || {}) },
        signal: AbortSignal.timeout(timeout) 
      });
      if (res.ok) {
        console.log(`[PROXY] RoProxy Success: ${url}`);
        return res;
      }
    } catch (e) {
      console.warn(`[PROXY] RoProxy failed for ${url}`);
    }

    // Try direct fetch as last resort
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...getHeaders(), ...(options.headers || {}) },
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) return res;
    } catch (e) {}

    return null;
  };

  const searchCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

  // Pool of "Average" bot profiles fetched from specified user's friends
  let BOT_FRIENDS_POOL: any[] = [];
  const TARGET_USER_IDS = [
    "5759164847", 
    "1971561259", 
    "2059255725", 
    "6159024302", 
    "5570252447", 
    "1760442395", 
    "224343004",
    "1720821531",
    "3738303782",
    "156528945",
    "215704944"
  ];

  const initializeFriendsPool = async () => {
    console.log("[INIT] Fetching bot friends pool...");
    const pool: any[] = [];
    const seenIds = new Set<string>();

    for (const userId of TARGET_USER_IDS) {
      try {
        const res = await fetchWithRetry(`https://friends.roblox.com/v1/users/${userId}/friends`, { headers: getHeaders() });
        const data = await res?.json();
        if (data?.data && Array.isArray(data.data)) {
          // Take first 30 friends from each target to build a diverse pool
          const friends = data.data.slice(0, 30);
          for (const friend of friends) {
            if (!seenIds.has(friend.id.toString())) {
              pool.push({
                id: friend.id,
                name: friend.name,
                displayName: friend.displayName
              });
              seenIds.add(friend.id.toString());
            }
          }
        }
      } catch (e) {
        console.error(`[INIT] Failed to fetch friends for ${userId}`, e);
      }
    }

    if (pool.length > 0) {
      // Fetch thumbnails in batches of 100 (Roblox API limit per request)
      const batchSize = 100;
      for (let i = 0; i < pool.length; i += batchSize) {
        const batch = pool.slice(i, i + batchSize);
        const ids = batch.map(u => u.id).join(",");
        try {
          const thumbRes = await fetchWithRetry(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids}&size=150x150&format=Png&isCircular=false`, { headers: getHeaders() });
          const thumbData = await thumbRes?.json();
          if (thumbData?.data) {
            batch.forEach(u => {
              const thumb = thumbData.data.find((t: any) => t.targetId.toString() === u.id.toString());
              u.avatarUrl = thumb?.imageUrl || "https://tr.rbxcdn.com/180DAY-40e9f0d0611c6d1d2b0e6e7c10b64ecc/150/150/AvatarHeadshot/Png/noFilter";
            });
          }
        } catch (e) {
          console.error(`[INIT] Thumbnail fetch failed for batch starting at ${i}`, e);
        }
      }
      BOT_FRIENDS_POOL = pool;
      console.log(`[INIT] Pool initialized with ${BOT_FRIENDS_POOL.length} profiles.`);
    }
  };

  // Initialize pool on start
  initializeFriendsPool();

  // Performance optimized fetch
  const fastFetch = async (url: string, options: any = {}, timeout = 8000) => {
    return fetchWithRetry(url, options, timeout);
  };

  // API Route: Search Roblox Usernames
  app.get("/api/search-roblox", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    const qLower = q.toLowerCase();
    if (!q || q.length < 1) return res.json([]);

    const cached = searchCache.get(qLower);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }
    
    try {
      const results: any[] = [];
      const seenIds = new Set<string>();
      const seenUsernames = new Set<string>();

      // Parallelize all search methods
      const searchPromises = [
        (async () => {
          if (q.includes(" ") || q.length < 2) return null;
          const r = await fastFetch(`https://users.roblox.com/v1/users/get-by-username?username=${encodeURIComponent(q)}`);
          return r?.ok ? r.json() : null;
        })(),
        (async () => {
          const r = await fastFetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(q)}&limit=10`);
          return r?.ok ? r.json() : null;
        })(),
        (async () => {
          if (q.includes(" ") || q.length < 2) return null;
          const r = await fastFetch(`https://users.roblox.com/v1/usernames/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [q], excludeBannedUsers: true })
          });
          return r?.ok ? r.json() : null;
        })()
      ];

      const settledResults = await Promise.allSettled(searchPromises);
      settledResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const data = result.value;
          if (data.id) {
            const lowName = (data.name || "").toLowerCase();
            if (!seenIds.has(data.id.toString()) && !seenUsernames.has(lowName)) { 
              results.push(data); 
              seenIds.add(data.id.toString()); 
              seenUsernames.add(lowName);
            }
          } else if (data.data) {
            for (const u of data.data) {
              const lowName = (u.name || "").toLowerCase();
              if (!seenIds.has(u.id.toString()) && !seenUsernames.has(lowName)) { 
                results.push(u); 
                seenIds.add(u.id.toString()); 
                seenUsernames.add(lowName);
              }
            }
          }
        }
      });

      // We need at least one real result to base others on
      let baseUser = results[0];
      let mappedResults: any[] = [];

      let originalAvatar = `https://tr.rbxcdn.com/180DAY-40e9f0d0611c6d1d2b0e6e7c10b64ecc/150/150/AvatarHeadshot/Png/noFilter`;
      let originalDisplay = q;
      let originalUsername = q;

      if (baseUser) {
        try {
          const thumbRes = await fastFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${baseUser.id}&size=150x150&format=Png&isCircular=false`);
          const thumbData = await thumbRes?.json();
          const thumb = thumbData?.data?.[0];
          if (thumb?.imageUrl) originalAvatar = thumb.imageUrl;
          
          originalDisplay = baseUser.displayName || baseUser.name;
          originalUsername = baseUser.name;
        } catch (e) {
          console.warn("Avatar fetch failed, using fallback");
        }
      }

      // 1. The Original Account
      mappedResults.push({
        display: originalDisplay,
        username: originalUsername,
        avatarUrl: originalAvatar,
        avatarLetter: originalDisplay.charAt(0).toUpperCase(),
        isFake: false
      });

      // Scramble helper for usernames
      const scramble = (name: string, type: number) => {
        if (type === 0) return name.replace(/[oO]/g, '0').replace(/[iIlL]/g, '1');
        if (type === 1) return name.replace(/[aA]/g, '4').replace(/[eE]/g, '3');
        return name + (Math.floor(Math.random() * 9) + 1);
      };

      // 2, 3, 4. Fake versions using REAL average profiles as base
      const pool = BOT_FRIENDS_POOL.length > 0 ? BOT_FRIENDS_POOL : [
        { avatarUrl: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-7276EB10D802477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter" },
        { avatarUrl: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-1002477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter" },
        { avatarUrl: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-E318C9101602477C9F9A7C91ECEEE44A-Png/150/150/AvatarHeadshot/Webp/noFilter" }
      ];

      const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
      for (let i = 0; i < 3; i++) {
        const botTemplate = shuffledPool[i % shuffledPool.length];
        let fakeUsername = scramble(originalUsername, i);
        if (fakeUsername === originalUsername) fakeUsername = originalUsername + (i + 1);
        
        mappedResults.push({
          display: fakeUsername, 
          username: fakeUsername,
          avatarUrl: botTemplate.avatarUrl,
          avatarLetter: fakeUsername.charAt(0).toUpperCase(),
          isFake: true
        });
      }

      searchCache.set(qLower, { data: mappedResults, timestamp: Date.now() });
      res.json(mappedResults);
    } catch (error) {
      console.error("[ROBLOX SEARCH] Error:", error);
      res.json([]);
    }
  });

  // API Route: Send Robux (Simulated)
  app.post("/api/send-robux", (req, res) => {
    const { from, to, amount } = req.body;
    console.log(`[BACKEND] ${amount} Robux sent from @${from} to @${to}`);
    res.json({ success: true, message: `Successfully sent ${amount} Robux!` });
  });

  // Admin Credentials Storage (Ephemeral in memory for now, could be moved to Firestore)
  let adminUser = process.env.VITE_ADMIN_USER || "rattpoor";
  let adminPass = process.env.VITE_ADMIN_PASS || "09094344916755";

  // API Route: Admin Authentication
  app.post("/api/admin-login", (req, res) => {
    const { username, password } = req.body;
    
    if (username === adminUser && password === adminPass) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials." });
    }
  });

  // API Route: Change Admin Password
  app.post("/api/admin/change-password", (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    if (username !== adminUser || currentPassword !== adminPass) {
      return res.status(401).json({ success: false, error: "Current password incorrect." });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password too short." });
    }

    adminPass = newPassword;
    console.log(`[ADMIN] Password updated for @${adminUser}`);
    res.json({ success: true });
  });

  // API Route: Log Access to Discord
  app.post("/api/log-access", async (req, res) => {
    const { key, ip, status, msg } = req.body;
    const webhookUrl = "https://discord.com/api/webhooks/1501679735456137246/vd3AfrcaoIRVuslVaUJlk6n6jIKBCYlTAEkq74N0QMKNu9oYBEoqaFU4kzW78ocAaao0";
    
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: status === 'success' ? "🔑 Key Verified - Access Granted" : "⚠️ Key Attempt - Access Denied",
            color: status === 'success' ? 0x00BCFF : 0xFF3131,
            description: msg || "No additional info available",
            fields: [
              { name: "Key used", value: `\`\`\`${key}\`\`\``, inline: false },
              { name: "IP Address", value: `\`${ip || 'Unknown'}\``, inline: true },
              { name: "Timestamp", value: new Date().toLocaleString(), inline: true }
            ],
            footer: { text: "SCorbin Security Service • HWID Guard" },
            timestamp: new Date().toISOString()
          }]
        })
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Failed to log" });
    }
  });

  // API Route: Fetch Detailed User Profile
  app.get("/api/user-profile/:username", async (req, res) => {
    try {
      const { username } = req.params;
      if (!username) return res.status(400).json({ error: "No username provided" });

      // Search for the user first to get ID
      const userLookupRes = await fetchWithRetry(`https://users.roblox.com/v1/users/get-by-username?username=${encodeURIComponent(username)}`, { headers: getHeaders() });
      const userLookupData: any = await userLookupRes?.json();
      
      const userId = userLookupData?.id;
      if (!userId) {
        return res.json({
          username: username,
          id: null,
          joinedYear: "2024",
          mutualFriends: 0,
          isNewFriend: true
        });
      }

      // Fetch official user data for detailed profile
      const userDetailRes = await fetchWithRetry(`https://users.roblox.com/v1/users/${userId}`, { headers: getHeaders() });
      const userDetailData: any = await userDetailRes?.json();

      let joinedYear = "2024";
      let joinedDate = "2024";
      if (userDetailData?.created) {
        const dateObj = new Date(userDetailData.created);
        joinedYear = dateObj.getFullYear().toString();
        joinedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
      }

      res.json({
        username: username,
        id: userId,
        joinedYear,
        joinedDate,
        mutualFriends: Math.floor(Math.random() * 2), // Still simulated but low
        isNewFriend: Math.random() > 0.8
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // API Route: Fetch User Avatar by Username
  app.get("/api/user-avatar/:username", async (req, res) => {
    try {
      const { username } = req.params;
      if (!username || username.length < 2) {
        return res.status(400).json({ error: "Invalid username" });
      }

      // 1. Get User ID from Username
      let userData: any = null;
      try {
        const userRes = await fetchWithRetry(`https://users.roblox.com/v1/users/get-by-username?username=${encodeURIComponent(username)}`, { headers: getHeaders() });
        userData = await userRes?.json();
      } catch (e) {
        console.warn(`[AVATAR] URL lookup failed for ${username}`, e);
      }

      if (!userData || !userData.id) {
        // Fallback: search as keyword and take first
        try {
          const searchRes = await fetchWithRetry(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`, { headers: getHeaders() });
          const searchData: any = await searchRes?.json();
          if (searchData?.data && searchData.data[0]) {
            userData = searchData.data[0];
          }
        } catch (e) {
          console.warn(`[AVATAR] Search fallback failed for ${username}`, e);
        }
      }

      if (!userData || !userData.id) {
         return res.status(404).json({ error: "User not found" });
      }

      // 2. Get Avatar Headshot URL
      const thumbRes = await fetchWithRetry(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userData.id}&size=150x150&format=Png&isCircular=false`, { headers: getHeaders() });
      const thumbData: any = await thumbRes?.json();
      const thumbnail = thumbData?.data?.[0];
      
      res.json({
        avatarUrl: thumbnail ? thumbnail.imageUrl : "https://tr.rbxcdn.com/180DAY-40e9f0d0611c6d1d2b0e6e7c10b64ecc/150/150/AvatarHeadshot/Png/noFilter",
        userId: userData.id,
        displayName: userData.displayName || userData.name || username
      });
    } catch (error) {
      console.error("Avatar fetch error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
