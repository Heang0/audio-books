class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentArticle = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = localStorage.getItem('audioVolume') || 1;
        this.playbackRate = localStorage.getItem('playbackRate') || 1.0;
        this.isExpanded = false;
        this.useHtml5Duration = false;
        this.isBuffering = false;
        this.hasFallback = false;
        this.preloadedChunks = [];
        this.bufferSize = 30;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        console.log('🎵 AudioPlayer initialized');
        this.checkBrowserSupport();
        this.init();
    }
    
    // Check browser and device capabilities
    checkBrowserSupport() {
        this.deviceInfo = {
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
            isAndroid: /Android/.test(navigator.userAgent),
            isSlowConnection: navigator.connection ? 
                (navigator.connection.effectiveType === 'slow-2g' || 
                 navigator.connection.effectiveType === '2g' ||
                 navigator.connection.saveData === true) : false,
            supportsMP3: !!this.audio.canPlayType('audio/mpeg').replace('no', '')
        };
        
        console.log('📱 Device Info:', this.deviceInfo);
        
        if (this.deviceInfo.isIOS) {
            this.audio.preload = 'none';
            this.bufferSize = 10;
        }
    }

    init() {
        this.setupAudioEvents();
        this.setupUIEvents();
        this.restoreSettings();
    }

    setupAudioEvents() {
        this.audio.addEventListener('loadedmetadata', () => {
            console.log('📊 HTML5 Audio metadata loaded');
            this.hideLoading();
            clearTimeout(this.loadTimeout);
            
            if (this.audio.duration && this.audio.duration > 0 && !isNaN(this.audio.duration)) {
                const html5Duration = Math.round(this.audio.duration);
                const dbDuration = this.currentArticle?.duration || 0;
                
                console.log('📊 Duration comparison:');
                console.log('   HTML5:', html5Duration, 'seconds');
                console.log('   Database:', dbDuration, 'seconds');
                
                const isSuspiciousDBDuration = dbDuration === 480 || dbDuration === 0 || dbDuration === 300;
                const isSignificantDifference = Math.abs(html5Duration - dbDuration) > 30;
                
                if (isSuspiciousDBDuration || isSignificantDifference) {
                    console.log('🔄 Using HTML5 duration (more accurate)');
                    this.duration = html5Duration;
                    this.useHtml5Duration = true;
                    this.updateDatabaseDuration(html5Duration);
                } else {
                    console.log('✅ Using database duration');
                    this.duration = dbDuration;
                    this.useHtml5Duration = false;
                }
            } else {
                console.log('⚠️ HTML5 duration invalid, using database');
                this.duration = this.currentArticle?.duration || 0;
                this.useHtml5Duration = false;
            }
            
            console.log('🎵 Final duration:', this.duration, 'seconds');
            this.updateDurationDisplay();
            this.updateTimeDisplay();
            this.updateProgressBar();
        });

this.audio.addEventListener('timeupdate', () => {
    this.currentTime = this.audio.currentTime;
    this.updateProgressBar();
    this.updateTimeDisplay();
    
    // Update media session position every 2 seconds
    if (Math.floor(this.currentTime) % 2 === 0) {
        this.updateMediaSession();
    }
});

        this.audio.addEventListener('ended', () => {
            console.log('⏹️ Audio ended');
            this.isPlaying = false;
            this.hideLoading();
            this.updatePlayButton();
            this.retryCount = 0;
        });

        this.audio.addEventListener('canplay', () => {
            console.log('▶️ Audio can play');
            this.hideLoading();
            this.isBuffering = false;
        });

        this.audio.addEventListener('canplaythrough', () => {
            console.log('✅ Entire audio can play through');
            this.isBuffering = false;
        });

        this.audio.addEventListener('waiting', () => {
            console.log('⏳ Audio buffering...');
            this.isBuffering = true;
            this.showLoading();
        });

        this.audio.addEventListener('playing', () => {
            console.log('🎵 Audio playing');
            this.isBuffering = false;
            this.hideLoading();
        });

        this.audio.addEventListener('pause', () => {
            console.log('⏸️ Audio paused');
            this.hideLoading();
            this.isPlaying = false;
            this.updatePlayButton();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('❌ Audio error:', e);
            console.error('Audio error details:', this.audio.error);
            
            this.hideLoading();
            clearTimeout(this.loadTimeout);
            
            const error = this.audio.error;
            if (error) {
                switch(error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        console.error('⚠️ Playback aborted by user');
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        console.error('🌐 Network error - retrying...');
                        this.retryWithFallback();
                        break;
                    case error.MEDIA_ERR_DECODE:
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        console.error('🔧 Format error - trying clean URL');
                        this.useCleanCloudinaryUrl();
                        break;
                }
            }
        });

        this.audio.addEventListener('progress', () => {
            if (this.audio.buffered.length > 0) {
                const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
                const bufferedPercent = (bufferedEnd / this.duration) * 100;
                this.updateBufferDisplay(bufferedPercent);
            }
        });
    }

    setupUIEvents() {
        console.log('🔧 Setting up UI events');
        this.setupDirectHandlers();
    }

    setupDirectHandlers() {
        const miniPlayBtn = document.getElementById('miniPlayBtn');
        const playPauseBtn = document.getElementById('playPauseBtn');
        
        if (miniPlayBtn) {
            miniPlayBtn.onclick = (e) => {
                e.stopPropagation();
                this.togglePlay();
            };
        }
        if (playPauseBtn) {
            playPauseBtn.onclick = (e) => {
                e.stopPropagation();
                this.togglePlay();
            };
        }

        const expandPlayer = document.getElementById('expandPlayer');
        const collapsePlayer = document.getElementById('collapsePlayer');
        
        if (expandPlayer) expandPlayer.onclick = (e) => {
            e.stopPropagation();
            this.expandPlayer();
        };
        if (collapsePlayer) collapsePlayer.onclick = (e) => {
            e.stopPropagation();
            this.collapsePlayer();
        };

        const rewindBtn = document.getElementById('rewindBtn');
        const forwardBtn = document.getElementById('forwardBtn');
        
        if (rewindBtn) rewindBtn.onclick = (e) => {
            e.stopPropagation();
            this.skip(-15);
        };
        if (forwardBtn) forwardBtn.onclick = (e) => {
            e.stopPropagation();
            this.skip(30);
        };

        const progressInput = document.getElementById('progressInput');
        const miniProgressInput = document.getElementById('miniProgressInput');
        
        if (progressInput) {
            progressInput.addEventListener('input', (e) => {
                const seekTime = (e.target.value / 100) * this.duration;
                this.seekTo(seekTime);
            });
            
            progressInput.addEventListener('touchstart', (e) => e.stopPropagation());
            progressInput.addEventListener('touchmove', (e) => e.stopPropagation());
        }
        
        if (miniProgressInput) {
            miniProgressInput.addEventListener('input', (e) => {
                const seekTime = (e.target.value / 100) * this.duration;
                this.seekTo(seekTime);
            });
            
            miniProgressInput.addEventListener('touchstart', (e) => e.stopPropagation());
            miniProgressInput.addEventListener('touchmove', (e) => e.stopPropagation());
        }

        const speedBtn = document.getElementById('speedBtn');
        if (speedBtn) speedBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleSpeed();
        };

        const volumeControl = document.getElementById('volumeControl');
        if (volumeControl) {
            volumeControl.value = this.volume * 100;
            volumeControl.addEventListener('input', (e) => {
                this.volume = e.target.value / 100;
                this.audio.volume = this.volume;
                this.updateVolumeIcon();
                localStorage.setItem('audioVolume', this.volume);
            });
        }

        const autoPlayToggle = document.getElementById('autoPlayToggle');
        if (autoPlayToggle) {
            autoPlayToggle.checked = localStorage.getItem('autoPlay') === 'true';
            autoPlayToggle.onchange = (e) => {
                localStorage.setItem('autoPlay', e.target.checked);
            };
        }
    }

    restoreSettings() {
        if (localStorage.getItem('audioVolume')) {
            this.volume = parseFloat(localStorage.getItem('audioVolume'));
            this.audio.volume = this.volume;
        }
        
        if (localStorage.getItem('playbackRate')) {
            this.playbackRate = parseFloat(localStorage.getItem('playbackRate'));
            this.audio.playbackRate = this.playbackRate;
            this.updateSpeedButton();
        }
        
        this.updateVolumeIcon();
    }

    // CLOUDINARY URL HANDLING - FIXED
    getCleanCloudinaryUrl(url) {
        if (!url || typeof url !== 'string') return url;
        
        console.log('🔗 Original URL:', url);
        
        if (!url.includes('cloudinary.com')) return url;
        
        // Extract clean URL: https://res.cloudinary.com/dpaq3ova2/video/upload/v1767691648/audio/nbz21wbvppzknuef0yew.mp3
        // Remove all transformation parameters
        
        // Method 1: Extract version and path
        const match = url.match(/(https:\/\/res\.cloudinary\.com\/[^\/]+\/video\/upload\/)(v\d+\/.+\.mp3)/i);
        if (match) {
            const cleanUrl = match[1] + match[2];
            console.log('🧹 Clean Cloudinary URL:', cleanUrl);
            return cleanUrl;
        }
        
        // Method 2: Remove transformation parameters
        if (url.includes('/upload/')) {
            const parts = url.split('/upload/');
            if (parts.length === 2) {
                const afterUpload = parts[1];
                const segments = afterUpload.split('/');
                
                // Find version segment (starts with v)
                const versionIndex = segments.findIndex(s => s.startsWith('v'));
                if (versionIndex !== -1) {
                    const cleanPath = segments.slice(versionIndex).join('/');
                    const cleanUrl = `${parts[0]}/upload/${cleanPath}`;
                    console.log('🧹 Clean URL (method 2):', cleanUrl);
                    return cleanUrl;
                }
            }
        }
        
        console.log('⚠️ Could not clean URL, using original');
        return url;
    }

    retryWithFallback() {
        if (this.retryCount >= this.maxRetries) {
            console.error('❌ Max retries reached');
            this.showError('មិនអាចទាញយកអូឌីយ៉ូ');
            return;
        }
        
        this.retryCount++;
        console.log(`🔄 Retry attempt ${this.retryCount}/${this.maxRetries}`);
        
        setTimeout(() => {
            if (this.currentArticle) {
                const cleanUrl = this.getCleanCloudinaryUrl(this.currentArticle.audioUrl);
                this.audio.src = cleanUrl;
                this.audio.load();
            }
        }, 1000 * this.retryCount);
    }

    useCleanCloudinaryUrl() {
        console.log('🔄 Switching to clean Cloudinary URL');
        if (this.currentArticle && this.currentArticle.audioUrl) {
            const cleanUrl = this.getCleanCloudinaryUrl(this.currentArticle.audioUrl);
            
            const currentTime = this.audio.currentTime;
            const wasPlaying = this.isPlaying;
            
            console.log('🎵 New clean URL:', cleanUrl);
            this.audio.src = cleanUrl;
            this.audio.currentTime = currentTime;
            this.audio.load();
            
            if (wasPlaying) {
                setTimeout(() => {
                    this.audio.play().catch(e => {
                        console.log('⚠️ Auto-play prevented after URL switch');
                    });
                }, 1000);
            }
        }
    }

    setupMediaSession() {
    if ('mediaSession' in navigator) {
        console.log('📱 Media Session API supported');
        
        try {
            // Use a fallback thumbnail if the current one fails
            const thumbnailUrl = this.currentArticle?.thumbnailUrl || '/assets/images/logo.png';
            
            // Set media session metadata
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentArticle?.title || 'Audio Article',
                artist: this.currentArticle?.category || 'Audio Articles',
                album: 'Audio Articles Platform',
                artwork: [
                    { src: thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
                    { src: thumbnailUrl, sizes: '128x128', type: 'image/jpeg' },
                    { src: thumbnailUrl, sizes: '192x192', type: 'image/jpeg' },
                    { src: thumbnailUrl, sizes: '256x256', type: 'image/jpeg' },
                    { src: thumbnailUrl, sizes: '384x384', type: 'image/jpeg' },
                    { src: thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
                ]
            });
            
            // Set action handlers
            navigator.mediaSession.setActionHandler('play', () => {
                console.log('📱 Media Session: Play requested');
                this.play();
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
                console.log('📱 Media Session: Pause requested');
                this.pause();
            });
            
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                console.log('📱 Media Session: Seek backward');
                this.skip(-10);
            });
            
            navigator.mediaSession.setActionHandler('seekforward', () => {
                console.log('📱 Media Session: Seek forward');
                this.skip(30);
            });
            
            // Optional handlers for next/previous
            try {
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    console.log('📱 Media Session: Previous track');
                    // You can implement previous article here
                });
                
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    console.log('📱 Media Session: Next track');
                    // You can implement next article here
                });
            } catch (error) {
                console.log('⚠️ Next/Previous not supported');
            }
            
            // Update playback state
            navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
            
        } catch (error) {
            console.error('❌ Media Session setup error:', error);
        }
    } else {
        console.log('⚠️ Media Session API not supported');
    }
}
// Add this method to update media session
updateMediaSession() {
    if ('mediaSession' in navigator) {
        // Update metadata if article changed
        if (this.currentArticle) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentArticle.title,
                artist: this.currentArticle.category,
                album: 'Audio Articles Platform',
                artwork: [
                    { src: this.currentArticle.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
                    { src: this.currentArticle.thumbnailUrl, sizes: '128x128', type: 'image/jpeg' },
                    { src: this.currentArticle.thumbnailUrl, sizes: '192x192', type: 'image/jpeg' },
                    { src: this.currentArticle.thumbnailUrl, sizes: '256x256', type: 'image/jpeg' },
                    { src: this.currentArticle.thumbnailUrl, sizes: '384x384', type: 'image/jpeg' },
                    { src: this.currentArticle.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
                ]
            });
        }
        
        // Update playback state
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
        
        // Update position state
        if (this.duration > 0) {
            navigator.mediaSession.setPositionState({
                duration: this.duration,
                playbackRate: this.playbackRate,
                position: this.currentTime
            });
        }
    }
}

    configureAudioForFastLoading() {
        if (this.deviceInfo.isIOS) {
            this.audio.preload = 'none';
        } else if (this.deviceInfo.isSlowConnection) {
            this.audio.preload = 'metadata';
        } else {
            this.audio.preload = 'auto';
        }
        
        this.audio.setAttribute('playsinline', '');
        this.audio.setAttribute('webkit-playsinline', '');
        this.audio.controls = false;
    }

    loadArticle(article) {
        console.log('📥 Loading article:', article?.title);
        
        if (!article || !article.audioUrl) {
            console.error('❌ Invalid article data');
            this.showError('មិនមានអូឌីយ៉ូ');
            return;
        }

        this.currentArticle = article;
        this.useHtml5Duration = false;
        this.isBuffering = true;
        this.retryCount = 0;
        this.hasFallback = false;
        
        try {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
            
            this.showLoading();
            
            if (article.duration && article.duration > 0 && !isNaN(article.duration)) {
                this.duration = article.duration;
                console.log('📊 Initial duration from database:', this.duration, 'seconds');
            } else {
                this.duration = 0;
                console.log('⚠️ No valid duration in database');
            }
            
            this.updateDurationDisplay();
            this.updateTimeDisplay();
            this.updateProgressBar();
            
            // USE CLEAN CLOUDINARY URL
            const cleanUrl = this.getCleanCloudinaryUrl(article.audioUrl);
            console.log('🔗 Final audio URL:', cleanUrl);
            
            this.audio.src = '';
            this.audio = new Audio();
            
            this.configureAudioForFastLoading();
            
            if (cleanUrl.includes('cloudinary.com')) {
                this.audio.crossOrigin = 'anonymous';
                console.log('☁️ Cloudinary URL detected, setting crossOrigin');
            }
            
            this.audio.src = cleanUrl;
            this.audio.volume = this.volume;
            this.audio.playbackRate = this.playbackRate;
            
            this.setupAudioEvents();
            
            this.updatePlayerInfo();
            this.showMiniPlayer();
            this.updatePlayButton();
            
            console.log('🔄 Loading audio metadata...');
            this.audio.load();
            
            this.loadTimeout = setTimeout(() => {
                if (this.isBuffering) {
                    console.log('⚠️ Slow loading, trying alternative...');
                    this.useCleanCloudinaryUrl();
                }
            }, 5000);
            
            console.log('✅ Audio source set, waiting for metadata...');

             setTimeout(() => this.setupMediaSession(), 1000);
            
        } catch (error) {
            console.error('❌ Error loading audio:', error);
            this.showError('មិនអាចផ្ទុកអូឌីយ៉ូ');
        }
    }

async play() {
    try {
        console.log('▶️ Attempting to play audio');
        
        // Setup media session for iOS/Android
        if ('mediaSession' in navigator) {
            this.setupMediaSession();
        }
        
        await this.audio.play();
        this.isPlaying = true;
        this.updatePlayButton();
        
        // Update media session state
        this.updateMediaSession();
        
        console.log('✅ Audio playing successfully');
        this.trackPlay();
        
    } catch (error) {
        console.error('❌ Error playing audio:', error);
        
        if (this.deviceInfo.isIOS && error.name === 'NotAllowedError') {
            this.showIOSPlaybackHint();
        }
        
        // Try clean URL if format error
        if (error.message.includes('format') || error.message.includes('not supported')) {
            console.log('🔄 Format error, trying clean URL...');
            this.useCleanCloudinaryUrl();
        }
    }
}

pause() {
    console.log('⏸️ Pausing audio');
    this.audio.pause();
    this.isPlaying = false;
    this.hideLoading();
    this.updatePlayButton();
    
    // ===== ADD THIS LINE HERE =====
    // Update media session when pausing
    this.updateMediaSession();
    // ===== END OF ADDED LINE =====
}

    togglePlay() {
        console.log('🔄 Toggle play, current state:', this.isPlaying);
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    seekTo(time) {
        time = Math.max(0, Math.min(time, this.duration));
        console.log('⏩ Seeking to:', time, 'seconds');
        
        this.audio.currentTime = time;
        this.currentTime = time;
        
        if (this.isPlaying) {
            this.audio.play().catch(e => {
                console.log('⚠️ Auto-play after seek prevented');
            });
        }
         this.updateMediaSession();
        this.updateProgressBar();
        this.updateTimeDisplay();
    }

    skip(seconds) {
        console.log('⏩ Skip:', seconds, 'seconds');
        const newTime = Math.max(0, this.audio.currentTime + seconds);
        this.seekTo(newTime);
    }

    toggleSpeed() {
        const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
        const currentIndex = speeds.indexOf(this.playbackRate);
        this.playbackRate = speeds[(currentIndex + 1) % speeds.length];
        this.audio.playbackRate = this.playbackRate;
        
        localStorage.setItem('playbackRate', this.playbackRate);
        
        this.updateSpeedButton();
        this.updateMediaSession();

    }

    updateSpeedButton() {
        const speedBtn = document.getElementById('speedBtn');
        if (speedBtn) {
            speedBtn.textContent = `${this.playbackRate.toFixed(1)}x`;
        }
    }

    updatePlayerInfo() {
        if (!this.currentArticle) return;

        this.setElementContent('miniThumbnail', this.currentArticle.thumbnailUrl);
        this.setElementContent('miniTitle', this.currentArticle.title);
        this.setElementContent('miniCategory', this.currentArticle.category);

        this.setElementContent('fullThumbnail', this.currentArticle.thumbnailUrl);
        this.setElementContent('fullTitle', this.currentArticle.title);
        this.setElementContent('fullCategory', this.currentArticle.category);
    }

    setElementContent(id, content) {
        const element = document.getElementById(id);
        if (element && content) {
            if (id.includes('Thumbnail')) {
                element.src = content;
                element.onerror = () => {
                    element.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzNkMzMC42Mjc0IDM2IDM2IDMwLjYyNzQgMzYgMjRDMzYgMTcuMzcyNiAzMC42Mjc0IDEyIDI0IDEyQzE3LjM3MjYgMTIgMTIgMTcu372NyAxMiAyNEMxMiAzMC42Mjc0IDE3LjM3MjYgMzYgMjQgMzZaIiBmaWxsPSIjRERCMDAwIi8+CjxwYXRoIGQ9Ik0yMCAxOVYyOUwyOCAyNEwyMCAxOVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPg==';
                };
            } else {
                element.textContent = content || '';
            }
        }
    }

    showMiniPlayer() {
        const miniPlayer = document.getElementById('miniPlayer');
        if (miniPlayer) {
            miniPlayer.style.display = 'block';
            miniPlayer.style.opacity = '1';
        }
    }

    expandPlayer() {
        this.isExpanded = true;
        const fullPlayer = document.getElementById('fullPlayer');
        const miniPlayer = document.getElementById('miniPlayer');
        
        if (fullPlayer) fullPlayer.classList.remove('translate-y-full');
        if (miniPlayer) miniPlayer.style.opacity = '0';
    }

    collapsePlayer() {
        this.isExpanded = false;
        const fullPlayer = document.getElementById('fullPlayer');
        const miniPlayer = document.getElementById('miniPlayer');
        
        if (fullPlayer) fullPlayer.classList.add('translate-y-full');
        if (miniPlayer) miniPlayer.style.opacity = '1';
    }

    updatePlayButton() {
        // Big player icons
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        
        if (playIcon && pauseIcon) {
            if (this.isPlaying) {
                playIcon.classList.add('hidden');
                pauseIcon.classList.remove('hidden');
            } else {
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
            }
        }

        // Mini player button
        const miniPlayBtn = document.getElementById('miniPlayBtn');
        if (miniPlayBtn) {
            const icon = miniPlayBtn.querySelector('i');
            if (icon) {
                icon.className = this.isPlaying ? 'fas fa-pause text-xs' : 'fas fa-play text-xs';
            }
        }
        
        // Main play button
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            if (icon) {
                if (!icon.classList.contains('fa-spinner')) {
                    icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
                }
            }
        }
    }

    updateProgressBar() {
        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        
        const miniProgress = document.getElementById('miniProgress');
        const fullProgress = document.getElementById('fullProgress');
        const miniProgressInput = document.getElementById('miniProgressInput');
        const progressInput = document.getElementById('progressInput');
        
        if (miniProgress) miniProgress.style.width = `${progress}%`;
        if (fullProgress) fullProgress.style.width = `${progress}%`;
        if (miniProgressInput) miniProgressInput.value = progress;
        if (progressInput) progressInput.value = progress;
        
        const miniHandle = document.getElementById('miniProgressHandle');
        const fullHandle = document.getElementById('fullProgressHandle');
        
        if (miniHandle) miniHandle.style.left = `${progress}%`;
        if (fullHandle) fullHandle.style.left = `${progress}%`;
    }

    updateBufferDisplay(bufferedPercent) {
        const bufferElement = document.getElementById('bufferProgress');
        if (bufferElement) {
            bufferElement.style.width = `${bufferedPercent}%`;
        }
    }

    updateTimeDisplay() {
        this.setElementContent('miniCurrentTime', this.formatTime(this.currentTime));
        this.setElementContent('fullCurrentTime', this.formatTime(this.currentTime));
        this.setElementContent('miniDuration', this.formatTime(this.duration));
        this.setElementContent('fullDuration', this.formatTime(this.duration));
    }

    updateDurationDisplay() {
        this.setElementContent('miniDuration', this.formatTime(this.duration));
        this.setElementContent('fullDuration', this.formatTime(this.duration));
    }

    updateVolumeIcon() {
        const volumeIcon = document.getElementById('volumeBtn');
        if (volumeIcon) {
            const icon = volumeIcon.querySelector('i');
            if (icon) {
                if (this.volume === 0) {
                    icon.className = 'fas fa-volume-mute';
                } else if (this.volume < 0.5) {
                    icon.className = 'fas fa-volume-down';
                } else {
                    icon.className = 'fas fa-volume-up';
                }
            }
        }
        
        const volumeControl = document.getElementById('volumeControl');
        if (volumeControl) {
            volumeControl.value = this.volume * 100;
        }
    }

    showLoading() {
        if (!this.isBuffering && this.isPlaying) {
            return;
        }
        
        const playBtn = document.getElementById('playPauseBtn');
        const miniPlayBtn = document.getElementById('miniPlayBtn');
        
        if (playBtn) {
            const icon = playBtn.querySelector('i');
            if (icon && !this.isPlaying) {
                icon.className = 'fas fa-spinner fa-spin';
            }
        }
        
        if (miniPlayBtn) {
            const icon = miniPlayBtn.querySelector('i');
            if (icon && !this.isPlaying) {
                icon.className = 'fas fa-spinner fa-spin text-xs';
            }
        }
        
        const bufferingIndicator = document.getElementById('bufferingIndicator');
        if (bufferingIndicator) {
            bufferingIndicator.classList.add('active');
        }
    }

    hideLoading() {
        console.log('🔴 DEBUG: hideLoading called');
        
        // Fix for big player
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        
        if (playIcon && pauseIcon) {
            playIcon.className = 'fas fa-play';
            pauseIcon.className = 'fas fa-pause';
            
            if (this.isPlaying) {
                playIcon.classList.add('hidden');
                pauseIcon.classList.remove('hidden');
            } else {
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
            }
        }
        
        // Fix for mini player
        const miniPlayBtn = document.getElementById('miniPlayBtn');
        if (miniPlayBtn) {
            const miniIcon = miniPlayBtn.querySelector('i');
            if (miniIcon) {
                miniIcon.className = this.isPlaying ? 'fas fa-pause text-xs' : 'fas fa-play text-xs';
            }
        }
        
        // Fix for big play button
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            const btnIcon = playPauseBtn.querySelector('i');
            if (btnIcon && btnIcon.classList.contains('fa-spinner')) {
                btnIcon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
        
        // Hide buffering indicator
        const bufferingIndicator = document.getElementById('bufferingIndicator');
        if (bufferingIndicator) {
            bufferingIndicator.classList.remove('active');
        }
        
        console.log('✅ Loading hidden for all players');
    }

    showError(message) {
        console.error('❌ Player Error:', message);
        
        const errorElement = document.getElementById('playerError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
            
            setTimeout(() => {
                errorElement.classList.add('hidden');
            }, 5000);
        }
    }

    showIOSPlaybackHint() {
        const hint = document.getElementById('iosPlaybackHint');
        if (hint) {
            hint.classList.remove('hidden');
            
            setTimeout(() => {
                hint.classList.add('hidden');
            }, 5000);
        }
    }

    async trackPlay() {
        if (!this.currentArticle || !this.currentArticle._id) return;
        
        try {
            await fetch(`http://localhost:5000/api/articles/${this.currentArticle._id}/play`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('📊 Play tracked');
        } catch (error) {
            console.error('❌ Error tracking play:', error);
        }
    }

    async updateDatabaseDuration(html5Duration) {
        if (!this.currentArticle || !this.currentArticle._id) {
            console.log('⚠️ No article ID, cannot update database');
            return;
        }
        
        const dbDuration = this.currentArticle.duration || 0;
        const diff = Math.abs(html5Duration - dbDuration);
        
        const shouldUpdate = diff > 30 || dbDuration === 0 || dbDuration === 480 || dbDuration === 300;
        
        if (shouldUpdate) {
            console.log(`💾 Updating database duration: ${dbDuration}s → ${html5Duration}s`);
            
            try {
                const response = await fetch(`http://localhost:5000/api/articles/${this.currentArticle._id}/duration`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duration: html5Duration })
                });
                
                if (response.ok) {
                    console.log('✅ Database duration updated');
                    this.currentArticle.duration = html5Duration;
                }
            } catch (error) {
                console.error('❌ Error updating database:', error);
            }
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    destroy() {
        this.audio.pause();
        this.audio.src = '';
        this.audio = null;
        this.currentArticle = null;
        
        console.log('🧹 AudioPlayer destroyed');
    }
}

// Initialize audio player globally
window.audioPlayer = new AudioPlayer();



// Handle beforeunload to save state
window.addEventListener('beforeunload', () => {
    if (window.audioPlayer) {
        localStorage.setItem('lastPlaybackTime', window.audioPlayer.currentTime);
        localStorage.setItem('lastArticleId', window.audioPlayer.currentArticle?._id || '');
    }
});