const Article = require('../models/Article');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudStorage');
const getAudioDuration = require('get-audio-duration');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Get all published articles
exports.getArticles = async (req, res) => {
  try {
    const { category, featured, limit = 10, page = 1 } = req.query;
    let query = { published: true };
    
    if (category) query.category = category;
    if (featured) query.featured = featured === 'true';
    
    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Article.countDocuments(query);
    
    res.json({
      articles,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single article
exports.getArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Increment play count
    article.plays += 1;
    await article.save();
    
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchArticles = async (req, res) => {
    try {
        const { q } = req.query;
        
        let searchQuery = { published: true };
        
        // Only add search filters if there's a query
        if (q && q.trim() !== '') {
            searchQuery = {
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { description: { $regex: q, $options: 'i' } },
                    { category: { $regex: q, $options: 'i' } }
                ],
                published: true
            };
        }
        // If q is empty, searchQuery stays as { published: true }
        // This will return ALL published articles
        
        const articles = await Article.find(searchQuery)
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ articles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create article with Cloudinary uploads and dynamic duration
exports.createArticle = async (req, res) => {
  try {
    console.log('=== CREATE ARTICLE START ===');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);

    if (!req.files || !req.files.audio || !req.files.thumbnail) {
      return res.status(400).json({ 
        error: 'Audio file and thumbnail image are required' 
      });
    }

    // ✅ IMPROVED DURATION CALCULATION
    let audioDuration = 0;
    let durationCalculationMethod = 'unknown';
    
    try {
      // Create temp directory
      const tempDir = path.join(__dirname, '../uploads/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Save audio to temp file
      const fileExtension = path.extname(req.files.audio[0].originalname) || '.mp3';
      const tempAudioPath = path.join(tempDir, `temp-audio-${Date.now()}${fileExtension}`);
      fs.writeFileSync(tempAudioPath, req.files.audio[0].buffer);
      
      console.log('📁 Temp file created:', tempAudioPath);
      console.log('📊 File size:', (req.files.audio[0].size / (1024 * 1024)).toFixed(2), 'MB');
      console.log('🎵 MIME type:', req.files.audio[0].mimetype);
      console.log('📄 Original name:', req.files.audio[0].originalname);
      
      // Method 1: Try ffprobe first (most reliable)
      try {
        const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempAudioPath}"`);
        const duration = parseFloat(stdout.trim());
        
        if (duration && !isNaN(duration) && duration > 0) {
          audioDuration = duration;
          durationCalculationMethod = 'ffprobe';
          console.log(`✅ Duration from ffprobe: ${audioDuration.toFixed(2)} seconds`);
        } else {
          throw new Error('ffprobe returned invalid duration');
        }
      } catch (ffprobeError) {
        console.log('⚠️ ffprobe failed, trying get-audio-duration...');
        
        // Method 2: Try getAudioDuration
        try {
          audioDuration = await getAudioDuration(tempAudioPath);
          durationCalculationMethod = 'get-audio-duration';
          console.log(`✅ Duration from get-audio-duration: ${audioDuration.toFixed(2)} seconds`);
        } catch (durationError) {
          console.log('⚠️ get-audio-duration failed, trying music-metadata...');
          
          // Method 3: Try music-metadata
          try {
            const musicMetadata = require('music-metadata');
            const metadata = await musicMetadata.parseFile(tempAudioPath);
            if (metadata.format.duration) {
              audioDuration = metadata.format.duration;
              durationCalculationMethod = 'music-metadata';
              console.log(`✅ Duration from music-metadata: ${audioDuration.toFixed(2)} seconds`);
            } else {
              throw new Error('music-metadata returned no duration');
            }
          } catch (metadataError) {
            console.log('⚠️ music-metadata failed, using file size estimation...');
            
            // Method 4: Estimate from file size (fallback)
            const fileSizeInBytes = req.files.audio[0].size;
            const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
            
            // Smart estimation based on file type
            if (req.files.audio[0].mimetype.includes('mp3')) {
              // MP3: 128 kbps = ~0.94 MB per minute
              audioDuration = Math.round((fileSizeInMB / 0.94) * 60);
            } else if (req.files.audio[0].mimetype.includes('m4a') || req.files.audio[0].mimetype.includes('aac')) {
              // AAC/M4A: 64 kbps = ~0.47 MB per minute
              audioDuration = Math.round((fileSizeInMB / 0.47) * 60);
            } else if (req.files.audio[0].mimetype.includes('wav')) {
              // WAV: 1411 kbps = ~10.6 MB per minute
              audioDuration = Math.round((fileSizeInMB / 10.6) * 60);
            } else {
              // Generic: 96 kbps = ~0.7 MB per minute
              audioDuration = Math.round((fileSizeInMB / 0.7) * 60);
            }
            
            durationCalculationMethod = 'file-size-estimation';
            console.log(`📏 Estimated duration from file size: ${audioDuration} seconds`);
            console.log(`📊 File size: ${fileSizeInMB.toFixed(2)} MB`);
          }
        }
      }
      
      // Clean up temp file
      fs.unlinkSync(tempAudioPath);
      console.log('🗑️ Temp file deleted');
      
    } catch (error) {
      console.error('❌ All duration calculation methods failed:', error);
      // Use provided duration from form or default
      audioDuration = parseInt(req.body.duration) || 300;
      durationCalculationMethod = 'fallback';
      console.log('🔄 Using fallback duration:', audioDuration, 'seconds');
    }

    // ✅ Validate and round duration
    audioDuration = Math.round(Number(audioDuration));
    if (isNaN(audioDuration) || audioDuration <= 0) {
      console.log('⚠️ Invalid duration, using default 300 seconds');
      audioDuration = 300;
      durationCalculationMethod = 'default';
    }
    
    const minutes = Math.floor(audioDuration / 60);
    const seconds = audioDuration % 60;
    
    console.log('✅ FINAL DURATION CALCULATION');
    console.log(`   Method: ${durationCalculationMethod}`);
    console.log(`   Duration: ${audioDuration} seconds`);
    console.log(`   Formatted: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    console.log(`   Is 8:00 (480s): ${audioDuration === 480 ? '⚠️ YES - Might be default' : '✅ NO - Real duration'}`);

    // Upload audio to Cloudinary
    console.log('☁️ Uploading audio to Cloudinary...');
    const audioUpload = await uploadToCloudinary(
      req.files.audio[0].buffer,
      'audio',
      'video'
    );
    console.log('✅ Audio uploaded:', audioUpload.secure_url);
    console.log('📊 Cloudinary response:', {
      format: audioUpload.format,
      duration: audioUpload.duration,
      bytes: audioUpload.bytes
    });

    // Upload thumbnail to Cloudinary
    console.log('🖼️ Uploading thumbnail to Cloudinary...');
    const thumbnailUpload = await uploadToCloudinary(
      req.files.thumbnail[0].buffer,
      'thumbnails',
      'image'
    );
    console.log('✅ Thumbnail uploaded:', thumbnailUpload.secure_url);

    // Create article with ACTUAL calculated duration
    const articleData = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      content: req.body.content || 'Audio content',
      duration: audioDuration,
      durationCalculationMethod: durationCalculationMethod, // Store how we calculated it
      audioUrl: audioUpload.secure_url,
      thumbnailUrl: thumbnailUpload.secure_url,
      audioPublicId: audioUpload.public_id,
      thumbnailPublicId: thumbnailUpload.public_id,
      published: req.body.published === 'true',
      featured: req.body.featured === 'true'
    };

    console.log('📝 Creating article in database...');
    const article = new Article(articleData);
    await article.save();
    
    console.log('✅ ARTICLE CREATED SUCCESSFULLY!');
    console.log('📊 FINAL ARTICLE DATA:', {
      id: article._id,
      title: article.title,
      duration: article.duration,
      durationMethod: article.durationCalculationMethod,
      formattedDuration: `${Math.floor(article.duration / 60)}:${Math.floor(article.duration % 60).toString().padStart(2, '0')}`,
      category: article.category,
      audioUrl: article.audioUrl.substring(0, 100) + '...'
    });
    console.log('=== CREATE ARTICLE END ===');
    
    res.status(201).json(article);
  } catch (error) {
    console.error('❌ Error creating article:', error);
    res.status(400).json({ error: error.message });
  }
};

// Update article with optional file uploads
exports.updateArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const updateData = { ...req.body };

    // Handle thumbnail upload if provided
    if (req.files && req.files.thumbnail) {
      const thumbnailUpload = await uploadToCloudinary(
        req.files.thumbnail[0].buffer,
        'thumbnails',
        'image'
      );
      updateData.thumbnailUrl = thumbnailUpload.secure_url;
      updateData.thumbnailPublicId = thumbnailUpload.public_id;
      
      // Delete old thumbnail from Cloudinary
      if (article.thumbnailPublicId) {
        await deleteFromCloudinary(article.thumbnailPublicId, 'image');
      }
    }

    const updatedArticle = await Article.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json(updatedArticle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete article and remove files from Cloudinary
exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Delete audio from Cloudinary
    if (article.audioPublicId) {
      await deleteFromCloudinary(article.audioPublicId, 'video');
    }

    // Delete thumbnail from Cloudinary
    if (article.thumbnailPublicId) {
      await deleteFromCloudinary(article.thumbnailPublicId, 'image');
    }

    // Delete from database
    await Article.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Article and associated files deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update article duration
exports.updateArticleDuration = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;
    
    if (!duration || isNaN(duration) || duration <= 0) {
      return res.status(400).json({ error: 'Valid duration is required' });
    }
    
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const oldDuration = article.duration;
    article.duration = Math.round(Number(duration));
    article.durationCalculationMethod = 'manual-update';
    await article.save();
    
    console.log(`✅ Updated article duration: ${article.title}`);
    console.log(`   Old: ${oldDuration}s (${Math.floor(oldDuration/60)}:${(oldDuration%60).toString().padStart(2,'0')})`);
    console.log(`   New: ${article.duration}s (${Math.floor(article.duration/60)}:${(article.duration%60).toString().padStart(2,'0')})`);
    
    res.json({
      success: true,
      message: 'Duration updated successfully',
      article: {
        id: article._id,
        title: article.title,
        oldDuration,
        newDuration: article.duration,
        formattedDuration: `${Math.floor(article.duration / 60)}:${Math.floor(article.duration % 60).toString().padStart(2, '0')}`
      }
    });
  } catch (error) {
    console.error('❌ Error updating duration:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get article with real duration from audio file
exports.getArticleWithRealDuration = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    let realDuration = article.duration;
    let durationSource = 'database';
    
    // Try to get real duration from audio URL
    try {
      if (article.audioUrl) {
        console.log(`🔍 Getting real duration for: ${article.title}`);
        console.log(`🔗 Audio URL: ${article.audioUrl}`);
        
        // Try to get duration from URL
        realDuration = await getAudioDuration(article.audioUrl);
        durationSource = 'audio-url';
        console.log(`✅ Got real duration from URL: ${realDuration}s`);
      }
    } catch (urlError) {
      console.log('⚠️ Could not get duration from URL, using database value');
    }
    
    // Format the response
    const response = {
      ...article.toObject(),
      realDuration: Math.round(realDuration),
      durationSource,
      formattedDuration: `${Math.floor(realDuration / 60)}:${Math.floor(realDuration % 60).toString().padStart(2, '0')}`,
      isDefault8Minutes: realDuration === 480
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DEBUG: Check all articles' durations
exports.debugDurations = async (req, res) => {
  try {
    const articles = await Article.find({}).select('title duration durationCalculationMethod createdAt audioUrl category plays').sort({ createdAt: -1 });
    
    console.log('=== DEBUG: ARTICLE DURATIONS ===');
    console.log(`Total articles: ${articles.length}`);
    
    let zeroDurationCount = 0;
    let eightMinuteCount = 0;
    
    articles.forEach(article => {
      const hasValidDuration = article.duration && article.duration > 0;
      const isEightMinutes = article.duration === 480;
      
      if (!hasValidDuration) zeroDurationCount++;
      if (isEightMinutes) eightMinuteCount++;
      
      console.log(`📄 ${article.title}`);
      console.log(`   📍 Category: ${article.category}`);
      console.log(`   ⏱️  Duration: ${article.duration}s (${Math.floor(article.duration/60)}:${(article.duration%60).toString().padStart(2,'0')})`);
      console.log(`   📊 Method: ${article.durationCalculationMethod || 'unknown'}`);
      console.log(`   📅 Created: ${article.createdAt.toLocaleDateString()}`);
      console.log(`   ▶️  Plays: ${article.plays}`);
      console.log(`   🔗 Has Audio: ${article.audioUrl ? '✅' : '❌'}`);
      console.log(`   ⚠️  Is 8:00: ${isEightMinutes ? 'YES' : 'NO'}`);
      console.log(`   ---`);
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total articles: ${articles.length}`);
    console.log(`   Zero duration: ${zeroDurationCount}`);
    console.log(`   8:00 duration: ${eightMinuteCount}`);
    console.log('=== DEBUG END ===');
    
    res.json({
      totalArticles: articles.length,
      articlesWithZeroDuration: zeroDurationCount,
      articlesWith8MinutesDuration: eightMinuteCount,
      articles: articles.map(a => ({
        title: a.title,
        duration: a.duration,
        durationMethod: a.durationCalculationMethod,
        durationFormatted: a.duration ? `${Math.floor(a.duration / 60)}:${Math.floor(a.duration % 60).toString().padStart(2, '0')}` : '0:00',
        category: a.category,
        createdAt: a.createdAt,
        plays: a.plays,
        hasAudioUrl: !!a.audioUrl,
        is8Minutes: a.duration === 480
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Fix duration for a specific article
exports.fixArticleDuration = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await Article.findById(id);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    console.log(`🔧 Fixing duration for article: ${article.title}`);
    console.log(`🔗 Audio URL: ${article.audioUrl}`);
    
    if (!article.audioUrl) {
      return res.status(400).json({ error: 'Article has no audio URL' });
    }
    
    let newDuration = 0;
    let method = 'unknown';
    
    try {
      // Try to get duration from Cloudinary URL
      newDuration = await getAudioDuration(article.audioUrl);
      method = 'get-audio-duration';
      console.log(`✅ Got duration from URL: ${newDuration}s`);
    } catch (urlError) {
      console.log('⚠️ Could not get duration from URL:', urlError.message);
      
      // If we have the audio file locally, try ffprobe
      try {
        // Check if we have a local copy
        const localPath = path.join(__dirname, '../uploads/audio', path.basename(article.audioUrl));
        if (fs.existsSync(localPath)) {
          const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localPath}"`);
          newDuration = parseFloat(stdout.trim());
          method = 'ffprobe-local';
          console.log(`✅ Got duration from local file: ${newDuration}s`);
        } else {
          throw new Error('No local file found');
        }
      } catch (localError) {
        console.log('⚠️ No local file, estimating...');
        
        // Estimate based on typical podcast length
        // Most podcasts are 5-15 minutes
        newDuration = 600; // 10 minutes as reasonable default
        method = 'estimated';
        console.log(`📏 Using estimated duration: ${newDuration}s (10:00)`);
      }
    }
    
    // Validate
    newDuration = Math.round(Number(newDuration));
    if (isNaN(newDuration) || newDuration <= 0) {
      newDuration = 300; // 5 minutes fallback
      method = 'fallback';
    }
    
    // Update article
    const oldDuration = article.duration;
    article.duration = newDuration;
    article.durationCalculationMethod = `fixed-${method}`;
    await article.save();
    
    console.log(`\n✅ SUCCESSFULLY FIXED DURATION!`);
    console.log(`   Article: ${article.title}`);
    console.log(`   Old: ${oldDuration}s (${Math.floor(oldDuration/60)}:${(oldDuration%60).toString().padStart(2,'0')})`);
    console.log(`   New: ${newDuration}s (${Math.floor(newDuration/60)}:${(newDuration%60).toString().padStart(2,'0')})`);
    console.log(`   Method: ${method}`);
    
    res.json({
      success: true,
      message: `Duration fixed from ${oldDuration}s to ${newDuration}s`,
      article: {
        id: article._id,
        title: article.title,
        oldDuration,
        newDuration,
        method,
        formattedDuration: `${Math.floor(newDuration / 60)}:${Math.floor(newDuration % 60).toString().padStart(2, '0')}`,
        is8Minutes: newDuration === 480
      }
    });
  } catch (error) {
    console.error('❌ Error fixing article duration:', error);
    res.status(500).json({ error: error.message });
  }
};

// Bulk fix all articles with 0 or 8:00 duration
exports.bulkFixDurations = async (req, res) => {
  try {
    console.log('🔧 Starting bulk duration fix...');
    
    // Find articles with 0 duration or exactly 480 seconds (8:00)
    const articles = await Article.find({
      $or: [
        { duration: 0 },
        { duration: 480 },
        { duration: { $exists: false } }
      ]
    });
    
    console.log(`Found ${articles.length} articles to fix`);
    
    const results = [];
    
    for (const article of articles) {
      try {
        console.log(`\n📄 Processing: ${article.title}`);
        console.log(`   Current duration: ${article.duration}s`);
        
        let newDuration = article.duration;
        let method = 'unchanged';
        
        // Only try to fix if we have audio URL
        if (article.audioUrl) {
          try {
            // Try to get real duration
            newDuration = await getAudioDuration(article.audioUrl);
            method = 'audio-url';
            console.log(`   ✅ Got real duration: ${newDuration}s`);
          } catch (error) {
            console.log(`   ⚠️ Could not get duration, keeping current`);
          }
        }
        
        // Update if different
        if (newDuration !== article.duration && newDuration > 0) {
          article.duration = Math.round(newDuration);
          article.durationCalculationMethod = `bulk-fix-${method}`;
          await article.save();
          console.log(`   ✅ Updated to: ${article.duration}s`);
        }
        
        results.push({
          title: article.title,
          id: article._id,
          oldDuration: article.duration,
          newDuration: article.duration,
          method,
          success: true
        });
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        results.push({
          title: article.title,
          id: article._id,
          error: error.message,
          success: false
        });
      }
    }
    
    console.log('\n✅ Bulk fix completed!');
    console.log(`   Total processed: ${articles.length}`);
    console.log(`   Successful: ${results.filter(r => r.success).length}`);
    
    res.json({
      success: true,
      message: `Bulk fix completed. Processed ${articles.length} articles.`,
      results
    });
  } catch (error) {
    console.error('❌ Error in bulk fix:', error);
    res.status(500).json({ error: error.message });
  }
};