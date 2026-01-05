// Main application JavaScript
class AudioArticlesApp {
    constructor() {
        this.articles = [];
        this.categories = [];
        this.currentArticle = null;
        this.apiBase = window.appConfig.apiBase;
        
        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadArticles();
        this.setupEventListeners();
        this.renderCategories();
        this.renderArticles();
    }

async loadCategories() {
    try {
        const response = await fetch(`${this.apiBase}/categories`);
        this.categories = await response.json();
        
        // TEMPORARY: If no categories, show some sample ones for testing
        if (this.categories.length === 0) {
            console.log('No categories found, showing fallback data');
            this.categories = [
                { name: 'បច្ចេកវិទ្យា', articleCount: 0 },
                { name: 'សុខភាព', articleCount: 0 },
                { name: 'ការអប់រំ', articleCount: 0 },
                { name: 'ជីវិតប្រចាំថ្ងៃ', articleCount: 0 },
                { name: 'ហិរញ្ញវត្ថុ', articleCount: 0 }
            ];
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async loadArticles(category = null) {
    try {
        let url = `${this.apiBase}/articles`;
        if (category) {
            url += `?category=${encodeURIComponent(category)}`;
        }
        
        console.log('🔍 Loading articles from:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📚 Articles data received:', data);
        
        // ADD THIS DETAILED DURATION DEBUG
        if (data.articles && data.articles.length > 0) {
            console.log('⏱️ DURATION DEBUG - All articles:');
            data.articles.forEach((article, index) => {
                console.log(`Article ${index + 1}:`, {
                    title: article.title,
                    duration: article.duration,
                    durationType: typeof article.duration,
                    is300: article.duration === 300,
                    formatted: this.formatDuration(article.duration)
                });
            });
        }
        
        this.articles = data.articles || [];
        
    } catch (error) {
        console.error('❌ Error loading articles:', error);
    }
}

  setupEventListeners() {
    // 🚨 REMOVE OR COMMENT OUT THIS SECTION 🚨
    /*
    // Mobile menu toggle - DELETE THIS
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
        });
    }
    */
    
    // Search functionality - KEEP THIS
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
    }

    // Category filter - KEEP THIS
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-filter')) {
            const category = e.target.dataset.category;
            this.filterByCategory(category);
        }
    });
}

renderCategories() {
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (!categoriesContainer) return;

    console.log('Categories data:', this.categories);

    categoriesContainer.innerHTML = this.categories.map(category => `
        <button class="category-chip category-filter flex-shrink-0 px-4 py-2 bg-gray-100 text-gray-800 rounded-full hover:bg-blue-100 transition-all duration-300 ${
            category === this.currentCategory ? 'active bg-blue-500 text-white' : ''
        }" data-category="${category.name}">
            ${category.name}
        </button>
    `).join('');
}
// In main.js - renderArticles method
renderArticles() {
    const articlesContainer = document.getElementById('articlesContainer');
    if (!articlesContainer) return;

    if (this.articles.length === 0) {
        articlesContainer.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-headphones text-6xl text-gray-300 mb-4"></i>
                <p class="text-gray-500 text-lg">No articles found</p>
            </div>
        `;
        return;
    }

    articlesContainer.innerHTML = this.articles.map(article => `
        <div class="article-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
             onclick="audioArticlesApp.navigateToArticle('${article._id}')">
            <div class="relative">
                <img src="${article.thumbnailUrl}" alt="${article.title}" 
                     class="w-full h-48 object-cover">
                <div class="absolute top-2 right-2">
                    <span class="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm professional-numbers">
                        ${this.formatDuration(article.duration)}
                    </span>
                </div>
                <button class="absolute bottom-2 left-2 play-article-btn w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-all"
                        data-article-id="${article._id}"
                        onclick="event.stopPropagation(); audioArticlesApp.playArticle('${article._id}')">
                    <i class="fas fa-play"></i>
                </button>
            </div>
            <div class="p-4">
                <span class="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    ${article.category}
                </span>
                <h3 class="font-semibold text-lg mt-2 mb-2 line-clamp-2">${article.title}</h3>
                <p class="text-gray-600 text-sm line-clamp-3">${article.description}</p>
                <div class="flex justify-between items-center mt-4 text-sm text-gray-500 professional-numbers">
                    <span><i class="fas fa-play mr-1"></i><span class="professional-numbers">${article.plays || 0}</span> plays</span>
                    <span class="professional-numbers">${this.formatDuration(article.duration)}</span>
                    <span class="professional-numbers">${this.formatDate(article.createdAt)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ADD THIS METHOD to your AudioArticlesApp class
navigateToArticle(articleId) {
    console.log('🔄 Navigating to article:', articleId);
    window.location.href = `/article?id=${articleId}`;
}

    async filterByCategory(category) {
        await this.loadArticles(category);
        this.renderArticles();
        
        // Update active category
        document.querySelectorAll('.category-chip').forEach(chip => {
            chip.classList.remove('active', 'bg-blue-500', 'text-white');
            if (chip.dataset.category === category) {
                chip.classList.add('active', 'bg-blue-500', 'text-white');
            }
        });
    }

    async playArticle(articleId) {
        try {
            const response = await fetch(`${this.apiBase}/articles/${articleId}`);
            this.currentArticle = await response.json();
            
            // Update audio player
            if (window.audioPlayer) {
                window.audioPlayer.loadArticle(this.currentArticle);
            }
            
            // Navigate to article page if not already there
            if (!window.location.pathname.includes('/article')) {
                window.location.href = `/article?id=${articleId}`;
            }
        } catch (error) {
            console.error('Error playing article:', error);
        }
    }
// UPDATE IN BOTH FILES
formatDuration(seconds) {
    // ✅ IMPROVED: Better handling for missing/incorrect durations
    if (!seconds || seconds === 0 || isNaN(seconds)) {
        return '0m 00s';
    }
    
    // Convert to number
    seconds = Number(seconds);
    
    // Handle negative values
    if (seconds < 0) seconds = 0;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
    } else {
        return `${secs}s`;
    }
}

formatPlays(plays) {
    if (!plays) return '0 plays';
    return `${plays} plays`;
}

formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        // Implement search logic here
        console.log('Searching for:', searchTerm);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.audioArticlesApp = new AudioArticlesApp();
});