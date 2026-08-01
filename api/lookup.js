const ROBLOX_BASES = {
  users: 'https://users.roblox.com',
  friends: 'https://friends.roblox.com',
  groups: 'https://groups.roblox.com',
  badges: 'https://badges.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com'
};

async function fetchWithRetry(url, maxRetries = 3, delay = 800) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.data && data.data[0] && data.data[0].state === 'Completed' && data.data[0].imageUrl) {
      return data.data[0].imageUrl;
    }
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delay));
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username } = req.body;
    if (!username) {
      res.status(400).json({ error: 'Username required' });
      return;
    }

    const lookupRes = await fetch(`${ROBLOX_BASES.users}/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });
    const lookupData = await lookupRes.json();

    if (!lookupData.data || lookupData.data.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userId = lookupData.data[0].id;

    const [infoRes, followersRes, followingRes, friendsRes, groupsRes, badgesRes] = await Promise.all([
      fetch(`${ROBLOX_BASES.users}/v1/users/${userId}`),
      fetch(`${ROBLOX_BASES.friends}/v1/users/${userId}/followers/count`),
      fetch(`${ROBLOX_BASES.friends}/v1/users/${userId}/followings/count`),
      fetch(`${ROBLOX_BASES.friends}/v1/users/${userId}/friends/count`),
      fetch(`${ROBLOX_BASES.groups}/v1/users/${userId}/groups/roles`),
      fetch(`${ROBLOX_BASES.badges}/v1/users/${userId}/badges?limit=10&sortOrder=Desc`)
    ]);

    const [info, followers, following, friends, groups, badges] = await Promise.all([
      infoRes.json(), followersRes.json(), followingRes.json(),
      friendsRes.json(), groupsRes.json(), badgesRes.json()
    ]);

    let avatarUrl = await fetchWithRetry(
      `${ROBLOX_BASES.thumbnails}/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
      3,
      800
    );

    if (!avatarUrl) {
      avatarUrl = await fetchWithRetry(
        `${ROBLOX_BASES.thumbnails}/v1/users/avatar-bust?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
        2,
        500
      );
    }

    if (!avatarUrl) {
      try {
        const avatar3dRes = await fetch(`https://www.roblox.com/avatar-thumbnail-3d/json?userId=${userId}`);
        const avatar3dData = await avatar3dRes.json();
        if (avatar3dData && avatar3dData.Url) {
          avatarUrl = avatar3dData.Url;
        }
      } catch (e) {}
    }

    if (!avatarUrl) {
      avatarUrl = await fetchWithRetry(
        `${ROBLOX_BASES.thumbnails}/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
        2,
        500
      );
    }

    if (!avatarUrl) {
      avatarUrl = `https://www.roblox.com/avatar/image?userId=${userId}&width=420&height=420&format=png`;
    }

    res.status(200).json({
      id: userId,
      name: info.name,
      displayName: info.displayName,
      description: info.description || '',
      created: info.created,
      avatarUrl: avatarUrl,
      followers: followers.count,
      following: following.count,
      friends: friends.count,
      groups: groups.data || [],
      badges: badges.data || []
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
