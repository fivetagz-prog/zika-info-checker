const ROBLOX_BASES = {
  users: 'https://users.roblox.com',
  friends: 'https://friends.roblox.com',
  groups: 'https://groups.roblox.com',
  badges: 'https://badges.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com'
};

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

    const [infoRes, followersRes, followingRes, friendsRes, avatarRes, groupsRes, badgesRes] = await Promise.all([
      fetch(`${ROBLOX_BASES.users}/v1/users/${userId}`),
      fetch(`${ROBLOX_BASES.friends}/v1/users/${userId}/followers/count`),
      fetch(`${ROBLOX_BASES.friends}/v1/users/${userId}/followings/count`),
      fetch(`${ROBLOX_BASES.friends}/v1/users/${userId}/friends/count`),
      fetch(`${ROBLOX_BASES.thumbnails}/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=true`),
      fetch(`${ROBLOX_BASES.groups}/v1/users/${userId}/groups/roles`),
      fetch(`${ROBLOX_BASES.badges}/v1/users/${userId}/badges?limit=10&sortOrder=Desc`)
    ]);

    const [info, followers, following, friends, avatar, groups, badges] = await Promise.all([
      infoRes.json(), followersRes.json(), followingRes.json(),
      friendsRes.json(), avatarRes.json(), groupsRes.json(), badgesRes.json()
    ]);

    res.status(200).json({
      id: userId,
      name: info.name,
      displayName: info.displayName,
      description: info.description || '',
      created: info.created,
      avatarUrl: avatar.data && avatar.data[0] ? avatar.data[0].imageUrl : '',
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
