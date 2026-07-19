const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure directories exist
const uploadDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadDir, 'images');
const audioDir = path.join(uploadDir, 'audio');
const publicDir = path.join(__dirname, 'public');

[uploadDir, imagesDir, audioDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve uploads statically
app.use('/uploads', express.static(uploadDir));
app.use(express.static(publicDir));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, imagesDir);
    } else if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.mp3')) {
      cb(null, audioDir);
    } else {
      cb(new Error('Invalid file type. Only audio and images are allowed.'), false);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// Database helper functions
const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { vowels: [], consonants: [], vowel_words: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}

// URL Normalizer to translate saved localhost paths to current request host dynamically
function normalizeUrls(obj, req) {
  if (!obj) return obj;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const currentOrigin = `${protocol}://${host}`;

  const jsonStr = JSON.stringify(obj);
  const normalizedStr = jsonStr.replace(/http:\/\/localhost:\d+/g, currentOrigin)
                               .replace(/http:\/\/10\.0\.2\.2:\d+/g, currentOrigin);
  return JSON.parse(normalizedStr);
}

// -------------------------------- API Endpoints --------------------------------

// 1. Get Lists
app.get('/api/vowels', (req, res) => {
  const db = readDB();
  res.json(normalizeUrls(db.vowels, req));
});

app.get('/api/consonants', (req, res) => {
  const db = readDB();
  res.json(normalizeUrls(db.consonants, req));
});

app.get('/api/words', (req, res) => {
  const db = readDB();
  res.json(normalizeUrls(db.vowel_words, req));
});

// 2. File Upload API
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Return the dynamic absolute URL to access the uploaded file
  const subfolder = req.file.mimetype.startsWith('image/') ? 'images' : 'audio';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/${subfolder}/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// 3. Update Vowel Item
app.post('/api/vowels/update', (req, res) => {
  const { char, textColor, cardColor, pronunciation, associatedWord, rhyme, imagePath, audioPath } = req.body;
  if (!char) return res.status(400).json({ error: 'Character (char) is required' });

  const db = readDB();
  const index = db.vowels.findIndex(item => item.char === char);
  
  if (index !== -1) {
    db.vowels[index] = {
      ...db.vowels[index],
      textColor: textColor || db.vowels[index].textColor,
      cardColor: cardColor || db.vowels[index].cardColor,
      pronunciation: pronunciation || db.vowels[index].pronunciation,
      associatedWord: associatedWord || db.vowels[index].associatedWord,
      rhyme: rhyme || db.vowels[index].rhyme,
      imagePath: imagePath || db.vowels[index].imagePath,
      audioPath: audioPath || db.vowels[index].audioPath
    };
    writeDB(db);
    res.json({ success: true, item: db.vowels[index] });
  } else {
    res.status(404).json({ error: 'Vowel character not found' });
  }
});

// 4. Update Consonant Item
app.post('/api/consonants/update', (req, res) => {
  const { char, textColor, cardColor, audioPath } = req.body;
  if (!char) return res.status(400).json({ error: 'Character (char) is required' });

  const db = readDB();
  const index = db.consonants.findIndex(item => item.char === char);
  
  if (index !== -1) {
    db.consonants[index] = {
      ...db.consonants[index],
      textColor: textColor || db.consonants[index].textColor,
      cardColor: cardColor || db.consonants[index].cardColor,
      audioPath: audioPath || db.consonants[index].audioPath
    };
    writeDB(db);
    res.json({ success: true, item: db.consonants[index] });
  } else {
    res.status(404).json({ error: 'Consonant character not found' });
  }
});

// 5. Update Vowel Word Item
app.post('/api/words/update', (req, res) => {
  const { letter, word, rhyme, imagePath, audioPath, themeColor, cardColor } = req.body;
  if (!letter) return res.status(400).json({ error: 'Letter is required' });

  const db = readDB();
  const index = db.vowel_words.findIndex(item => item.letter === letter);
  
  if (index !== -1) {
    db.vowel_words[index] = {
      ...db.vowel_words[index],
      word: word || db.vowel_words[index].word,
      rhyme: rhyme || db.vowel_words[index].rhyme,
      imagePath: imagePath || db.vowel_words[index].imagePath,
      audioPath: audioPath || db.vowel_words[index].audioPath,
      themeColor: themeColor || db.vowel_words[index].themeColor,
      cardColor: cardColor || db.vowel_words[index].cardColor
    };
    writeDB(db);
    res.json({ success: true, item: db.vowel_words[index] });
  } else {
    res.status(404).json({ error: 'Word item not found for this letter' });
  }
});

// 6. Get Settings API
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(normalizeUrls(db.settings || {}, req));
});

// 7. Update Settings API
app.post('/api/settings/update', (req, res) => {
  const { 
    welcomeText, welcomeAudioPath, 
    banglaIntroText, banglaIntroAudioPath,
    vowelsIntroText, vowelsIntroAudioPath,
    consonantsIntroText, consonantsIntroAudioPath
  } = req.body;
  const db = readDB();
  
  db.settings = {
    ...db.settings,
    welcomeText: welcomeText !== undefined ? welcomeText : db.settings.welcomeText,
    welcomeAudioPath: welcomeAudioPath !== undefined ? welcomeAudioPath : db.settings.welcomeAudioPath,
    banglaIntroText: banglaIntroText !== undefined ? banglaIntroText : db.settings.banglaIntroText,
    banglaIntroAudioPath: banglaIntroAudioPath !== undefined ? banglaIntroAudioPath : db.settings.banglaIntroAudioPath,
    vowelsIntroText: vowelsIntroText !== undefined ? vowelsIntroText : db.settings.vowelsIntroText,
    vowelsIntroAudioPath: vowelsIntroAudioPath !== undefined ? vowelsIntroAudioPath : db.settings.vowelsIntroAudioPath,
    consonantsIntroText: consonantsIntroText !== undefined ? consonantsIntroText : db.settings.consonantsIntroText,
    consonantsIntroAudioPath: consonantsIntroAudioPath !== undefined ? consonantsIntroAudioPath : db.settings.consonantsIntroAudioPath
  };
  
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// 8. Reset database to defaults
app.post('/api/reset', (req, res) => {
  // Simple check to reseed from scratch
  const seed = {
    vowels: [
      { "char": "অ", "textColor": "#EF5350", "cardColor": "#FFFFEBEE", "pronunciation": "অ, শরে অ", "associatedWord": "অজগর", "rhyme": "অ-তে অজগর আসছে তেড়ে।", "imagePath": "assets/images/vowel_o_ajagor.png", "audioPath": "audio/o.mp3" },
      { "char": "আ", "textColor": "#FB8C00", "cardColor": "#FFF3E0", "pronunciation": "আ, শরে আ", "associatedWord": "আম", "rhyme": "আ-তে আমটি আমি খাব পেড়ে।", "imagePath": "assets/images/vowel_a_aam.png", "audioPath": "audio/a.mp3" },
      { "char": "ই", "textColor": "#FBC02D", "cardColor": "#FFFDE7", "pronunciation": "ই, রশশো ই", "associatedWord": "ইঁদুর", "rhyme": "ই-তে ইঁদুর ছানা ভয়ে মরে।", "imagePath": "assets/images/vowel_i_indur.png", "audioPath": "audio/i.mp3" },
      { "char": "ঈ", "textColor": "#7CB342", "cardColor": "#F1F8E9", "pronunciation": "ঈ, দিরগো ঈ", "associatedWord": "ঈগল", "rhyme": "ঈ-তে ঈগল পাখি পাছে ধরে।", "imagePath": "assets/images/vowel_ii_eagle.png", "audioPath": "audio/ii.mp3" },
      { "char": "উ", "textColor": "#00897B", "cardColor": "#E0F2F1", "pronunciation": "উ, রশশো উ", "associatedWord": "উট", "rhyme": "উ-তে উট চলেছে মুখটি তুলে।", "imagePath": "assets/images/vowel_u_oot.png", "audioPath": "audio/u.mp3" },
      { "char": "ঊ", "textColor": "#00ACC1", "cardColor": "#E0F7FA", "pronunciation": "ঊ, দিরগো ঊ", "associatedWord": "ঊষা", "rhyme": "ঊ-তে ঊষা হাসে পুব আকাশে।", "imagePath": "assets/images/vowel_uu_usha.png", "audioPath": "audio/uu.mp3" },
      { "char": "ঋ", "textColor": "#039BE5", "cardColor": "#E1F5FE", "pronunciation": "ঋ", "associatedWord": "ঋষি", "rhyme": "ঋ-তে ঋষি মশায় বসেন পূজায়।", "imagePath": "assets/images/vowel_ri_rishi.png", "audioPath": "audio/ri.mp3" },
      { "char": "এ", "textColor": "#3949AB", "cardColor": "#E8EAF6", "pronunciation": "এ", "associatedWord": "একতারা", "rhyme": "এ-তে একতারাটি বাজে বেশ।", "imagePath": "assets/images/vowel_e_ektara.png", "audioPath": "audio/e.mp3" },
      { "char": "ঐ", "textColor": "#5E35B1", "cardColor": "#EDE7F6", "pronunciation": "ঐ", "associatedWord": "ঐরাবত", "rhyme": "ঐ-তে ঐরাবত চলেছে ধীরে।", "imagePath": "assets/images/vowel_oi_oirabot.png", "audioPath": "audio/oi.mp3" },
      { "char": "ও", "textColor": "#8E24AA", "cardColor": "#F3E5F5", "pronunciation": "ও", "associatedWord": "ওল", "rhyme": "ও-তে ওল খেয়ো না ধরবে গলা।", "imagePath": "assets/images/vowel_o_ol.png", "audioPath": "audio/o_vowel.mp3" },
      { "char": "ঔ", "textColor": "#D81B60", "cardColor": "#FCE4EC", "pronunciation": "ঔ", "associatedWord": "ঔষধ", "rhyme": "ঔ-তে ঔষধ খাবে অসুখ হলে।", "imagePath": "assets/images/vowel_ou_oushodh.png", "audioPath": "audio/ou.mp3" }
    ],
    consonants: [
      { "char": "ক", "textColor": "#EF5350", "cardColor": "#FFFFEBEE", "audioPath": "audio/consonants/ko.mp3" },
      { "char": "খ", "textColor": "#FB8C00", "cardColor": "#FFF3E0", "audioPath": "audio/consonants/kho.mp3" },
      { "char": "গ", "textColor": "#FBC02D", "cardColor": "#FFFDE7", "audioPath": "audio/consonants/go.mp3" },
      { "char": "ঘ", "textColor": "#7CB342", "cardColor": "#F1F8E9", "audioPath": "audio/consonants/gho.mp3" },
      { "char": "ঙ", "textColor": "#00897B", "cardColor": "#E0F2F1", "audioPath": "audio/consonants/umo.mp3" },
      { "char": "চ", "textColor": "#00ACC1", "cardColor": "#E0F7FA", "audioPath": "audio/consonants/cho.mp3" },
      { "char": "ছ", "textColor": "#039BE5", "cardColor": "#E1F5FE", "audioPath": "audio/consonants/chho.mp3" },
      { "char": "জ", "textColor": "#3949AB", "cardColor": "#E8EAF6", "audioPath": "audio/consonants/jo.mp3" },
      { "char": "ঝ", "textColor": "#8E24AA", "cardColor": "#F3E5F5", "audioPath": "audio/consonants/jho.mp3" },
      { "char": "ঞ", "textColor": "#D81B60", "cardColor": "#FCE4EC", "audioPath": "audio/consonants/niyo.mp3" },
      { "char": "ট", "textColor": "#EF5350", "cardColor": "#FFFFEBEE", "audioPath": "audio/consonants/to_hard.mp3" },
      { "char": "ঠ", "textColor": "#FB8C00", "cardColor": "#FFF3E0", "audioPath": "audio/consonants/tho_hard.mp3" },
      { "char": "ড", "textColor": "#FBC02D", "cardColor": "#FFFDE7", "audioPath": "audio/consonants/do_hard.mp3" },
      { "char": "ঢ", "textColor": "#7CB342", "cardColor": "#F1F8E9", "audioPath": "audio/consonants/dho_hard.mp3" },
      { "char": "ণ", "textColor": "#00897B", "cardColor": "#E0F2F1", "audioPath": "audio/consonants/n_hard.mp3" },
      { "char": "ত", "textColor": "#00ACC1", "cardColor": "#E0F7FA", "audioPath": "audio/consonants/to_soft.mp3" },
      { "char": "থ", "textColor": "#039BE5", "cardColor": "#E1F5FE", "audioPath": "audio/consonants/tho_soft.mp3" },
      { "char": "দ", "textColor": "#3949AB", "cardColor": "#E8EAF6", "audioPath": "audio/consonants/do_soft.mp3" },
      { "char": "ধ", "textColor": "#8E24AA", "cardColor": "#F3E5F5", "audioPath": "audio/consonants/dho_soft.mp3" },
      { "char": "ন", "textColor": "#D81B60", "cardColor": "#FCE4EC", "audioPath": "audio/consonants/n_soft.mp3" },
      { "char": "প", "textColor": "#EF5350", "cardColor": "#FFFFEBEE", "audioPath": "audio/consonants/po.mp3" },
      { "char": "ফ", "textColor": "#FB8C00", "cardColor": "#FFF3E0", "audioPath": "audio/consonants/pho.mp3" },
      { "char": "ব", "textColor": "#FBC02D", "cardColor": "#FFFDE7", "audioPath": "audio/consonants/bo.mp3" },
      { "char": "ভ", "textColor": "#7CB342", "cardColor": "#F1F8E9", "audioPath": "audio/consonants/bho.mp3" },
      { "char": "ম", "textColor": "#00897B", "cardColor": "#E0F2F1", "audioPath": "audio/consonants/mo.mp3" },
      { "char": "য", "textColor": "#00ACC1", "cardColor": "#E0F7FA", "audioPath": "audio/consonants/yo.mp3" },
      { "char": "র", "textColor": "#039BE5", "cardColor": "#E1F5FE", "audioPath": "audio/consonants/ro.mp3" },
      { "char": "ল", "textColor": "#3949AB", "cardColor": "#E8EAF6", "audioPath": "audio/consonants/lo.mp3" },
      { "char": "শ", "textColor": "#8E24AA", "cardColor": "#F3E5F5", "audioPath": "audio/consonants/sho_1.mp3" },
      { "char": "ষ", "textColor": "#D81B60", "cardColor": "#FCE4EC", "audioPath": "audio/consonants/sho_2.mp3" },
      { "char": "স", "textColor": "#EF5350", "cardColor": "#FFFFEBEE", "audioPath": "audio/consonants/sho_3.mp3" },
      { "char": "হ", "textColor": "#FB8C00", "cardColor": "#FFF3E0", "audioPath": "audio/consonants/ho.mp3" },
      { "char": "ড়", "textColor": "#FBC02D", "cardColor": "#FFFDE7", "audioPath": "audio/consonants/ro_hard.mp3" },
      { "char": "ঢ়", "textColor": "#7CB342", "cardColor": "#F1F8E9", "audioPath": "audio/consonants/rho_hard.mp3" },
      { "char": "য়", "textColor": "#00897B", "cardColor": "#E0F2F1", "audioPath": "audio/consonants/yo_soft.mp3" },
      { "char": "ৎ", "textColor": "#00ACC1", "cardColor": "#E0F7FA", "audioPath": "audio/consonants/t_short.mp3" },
      { "char": "ং", "textColor": "#039BE5", "cardColor": "#E1F5FE", "audioPath": "audio/consonants/onushshor.mp3" },
      { "char": "ঃ", "textColor": "#3949AB", "cardColor": "#E8EAF6", "audioPath": "audio/consonants/bisorgo.mp3" },
      { "char": "ঁ", "textColor": "#8E24AA", "cardColor": "#F3E5F5", "audioPath": "audio/consonants/chondrobindu.mp3" }
    ],
    vowel_words: [
      { "letter": "অ", "word": "অজগর", "rhyme": "অজগর আসছে তেড়ে", "imagePath": "assets/images/vowel_o_ajagor.png", "audioPath": "audio/o_word.mp3", "themeColor": "#EF5350", "cardColor": "#FFFFEBEE" },
      { "letter": "আ", "word": "আম", "rhyme": "আমটি আমি খাব পেড়ে", "imagePath": "assets/images/vowel_a_aam.png", "audioPath": "audio/a_word.mp3", "themeColor": "#FB8C00", "cardColor": "#FFF3E0" },
      { "letter": "ই", "word": "ইঁদুর", "rhyme": "ইঁদুর-ছানা ভয়ে মরে", "imagePath": "assets/images/vowel_i_indur.png", "audioPath": "audio/i_word.mp3", "themeColor": "#FBC02D", "cardColor": "#FFFDE7" },
      { "letter": "ঈ", "word": "ঈগল", "rhyme": "ঈগল পাখি পাছে ধরে", "imagePath": "assets/images/vowel_ii_eagle.png", "audioPath": "audio/ii_word.mp3", "themeColor": "#7CB342", "cardColor": "#F1F8E9" },
      { "letter": "উ", "word": "উট", "rhyme": "উট চলেছে মুখটি তুলে", "imagePath": "assets/images/vowel_u_oot.png", "audioPath": "audio/u_word.mp3", "themeColor": "#00897B", "cardColor": "#E0F2F1" },
      { "letter": "ঊ", "word": "ঊষা", "rhyme": "দীর্ঘ ঊ-টি আছে ঝুলে", "imagePath": "assets/images/vowel_uu_usha.png", "audioPath": "audio/uu_word.mp3", "themeColor": "#00ACC1", "cardColor": "#E0F7FA" },
      { "letter": "ঋ", "word": "ঋষি", "rhyme": "ঋষি মশাই বসেন পূজায়", "imagePath": "assets/images/vowel_ri_rishi.png", "audioPath": "audio/ri_word.mp3", "themeColor": "#039BE5", "cardColor": "#E1F5FE" },
      { "letter": "এ", "word": "একতারা", "rhyme": "এক্কা গাড়ি খুব ছুটেছে", "imagePath": "assets/images/vowel_e_ektara.png", "audioPath": "audio/e_word.mp3", "themeColor": "#3949AB", "cardColor": "#E8EAF6" },
      { "letter": "ঐ", "word": "ঐরাবত", "rhyme": "ঐ দেখ ভাই চাঁদ উঠেছে", "imagePath": "assets/images/vowel_oi_oirabot.png", "audioPath": "audio/oi_word.mp3", "themeColor": "#5E35B1", "cardColor": "#EDE7F6" },
      { "letter": "ও", "word": "ওল", "rhyme": "ওল খেয়ো না ধরবে গলা", "imagePath": "assets/images/vowel_o_ol.png", "audioPath": "audio/o_vowel_word.mp3", "themeColor": "#8E24AA", "cardColor": "#F3E5F5" },
      { "letter": "ঔ", "word": "ঔষধ", "rhyme": "ঔষধ খেতে মিছে বলা", "imagePath": "assets/images/vowel_ou_oushodh.png", "audioPath": "audio/ou_word.mp3", "themeColor": "#D81B60", "cardColor": "#FCE4EC" }
    ],
    settings: {
      "welcomeText": "বই পড়ি অ্যাপে স্বাগতম! পড়ার ক্যাটাগরি বেছে নিতে নিচের যেকোনো একটি বড় বাটনে চাপ দাও।",
      "welcomeAudioPath": "audio/welcome.mp3",
      "banglaIntroText": "এসো বাংলা শিখি! স্বরবর্ণ, ব্যঞ্জনবর্ণ ও শব্দ শিখতে নিচে চাপ দাও।",
      "banglaIntroAudioPath": "audio/bangla_intro.mp3",
      "vowelsIntroText": "এসো স্বরবর্ণ শিখি! যেকোনো একটি বর্ণে চাপ দাও অথবা ওপরের প্লে বাটনে চাপ দাও।",
      "vowelsIntroAudioPath": "audio/vowels_intro.mp3",
      "consonantsIntroText": "এসো ব্যঞ্জনবর্ণ শিখি! যেকোনো একটি বর্ণে চাপ দাও অথবা ওপরের প্লে বাটনে চাপ দাও।",
      "consonantsIntroAudioPath": "audio/consonants_intro.mp3"
    }
  };
  writeDB(seed);
  res.json({ success: true, message: 'Database reset successfully' });
});

app.listen(PORT, () => {
  console.log(`Boi Pori API server running at http://localhost:${PORT}`);
});
