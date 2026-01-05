// Article page functionality
class ArticlePage {
    constructor() {
        this.apiBase = window.appConfig.apiBase;
        this.currentArticleId = null;
        this.init();
    }

    async init() {
        await this.loadArticle();
        await this.loadRelatedArticles();
    }

    async loadArticle() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentArticleId = urlParams.get('id');

        console.log('Article ID:', this.currentArticleId); // Debug

        if (!this.currentArticleId) {
            this.showError('មិនមានអត្ថបទ');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/articles/${this.currentArticleId}`);
            console.log('Response status:', response.status); // Debug
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const article = await response.json();
            console.log('Article data:', article); // Debug
            
            this.renderArticle(article);
            
            // Load article into audio player if available
            if (window.audioPlayer && typeof window.audioPlayer.loadArticle === 'function') {
                try {
                    window.audioPlayer.loadArticle(article);
                } catch (audioError) {
                    console.error('Error loading audio:', audioError);
                }
            }
        } catch (error) {
            console.error('Error loading article:', error);
            this.showError('កំហុសក្នុងការផ្ទុកអត្ថបទ: ' + error.message);
        }
    }

// Add this to the ArticlePage class in article.js
async playRelatedArticle(articleId) {
    try {
        const response = await fetch(`${this.apiBase}/articles/${articleId}`);
        const article = await response.json();
        
        if (article && window.audioPlayer) {
            window.audioPlayer.loadArticle(article);
            window.audioPlayer.play();
        }
    } catch (error) {
        console.error('Error playing related article:', error);
    }
}

    async loadRelatedArticles() {
    if (!this.currentArticleId) return;

    try {
        // First, get the current article to know its category
        const currentArticleResponse = await fetch(`${this.apiBase}/articles/${this.currentArticleId}`);
        const currentArticle = await currentArticleResponse.json();
        
        if (!currentArticle) {
            this.showRelatedArticlesError();
            return;
        }

        // Get articles from the SAME CATEGORY, excluding current article
        const response = await fetch(`${this.apiBase}/articles?category=${encodeURIComponent(currentArticle.category)}&limit=6`);
        console.log('Related articles response:', response);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Related articles data:', data);
        
        // Filter out the current article
        const relatedArticles = (data.articles || []).filter(article => 
            article._id !== this.currentArticleId
        ).slice(0, 4); // Show max 4 related articles
        
        console.log('Filtered related articles:', relatedArticles);
        
        this.renderRelatedArticles(relatedArticles);
        
    } catch (error) {
        console.error('Error loading related articles:', error);
        this.showRelatedArticlesError();
    }
}

renderArticle(article) {
    const articleContent = document.getElementById('articleContent');
    
    if (!articleContent) return;
    
    articleContent.innerHTML = `
        <div class="text-center mb-6">
            <span class="inline-block text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full mb-4">
                ${article.category || 'No category'}
            </span>
            
            <h1 class="text-2xl md:text-4xl font-bold text-gray-800 mb-4 leading-tight">${article.title}</h1>
            
            <div class="flex items-center justify-center space-x-6 text-sm text-gray-500 mb-6 professional-numbers">
                <span class="flex items-center space-x-1">
                    <i class="fas fa-play"></i>
                    <span>${this.formatPlays(article.plays)}</span>
                </span>
                <span class="flex items-center space-x-1">
                    <i class="fas fa-clock"></i>
                    <span>${this.formatDuration(article.duration)}</span>
                </span>
                <span>${this.formatDate(article.createdAt)}</span>
            </div>
        </div>

        ${article.thumbnailUrl ? `
            <img src="${article.thumbnailUrl}" alt="${article.title}" 
                 class="w-full h-64 md:h-80 object-cover rounded-2xl shadow-lg mb-6">
        ` : ''}
        
        <div class="prose max-w-none text-gray-700 leading-relaxed">
            <p class="text-lg mb-6">${article.description || ''}</p>
            
            <!-- REMOVED: The "Ready to listen!" section -->
            <!-- This section was here before:
            <div class="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 text-center border border-red-100">
                <i class="fas fa-headphones brand-color text-2xl mb-3"></i>
                <p class="text-gray-700 font-medium mb-2">Ready to listen!</p>
                <p class="text-sm text-gray-600">Click the Play button on the audio player to start listening</p>
            </div>
            -->
        </div>
    `;
}

renderRelatedArticles(articles) {
    const container = document.getElementById('relatedArticlesList');
    if (!container) {
        console.error('Related articles container not found!');
        return;
    }

    console.log('Rendering related articles:', articles);

    if (!articles || articles.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-newspaper text-3xl mb-3 text-gray-400"></i>
                <p class="text-gray-600">មិនមានអត្ថបទពាក់ព័ន្ធ</p>
                <p class="text-sm text-gray-500 mt-2">អត្ថបទផ្សេងទៀតនឹងបង្ហាញនៅពេលក្រោយ</p>
            </div>
        `;
        return;
    }

    container.innerHTML = articles.map(article => `
        <div class="flex items-center space-x-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md smooth-transition cursor-pointer border border-gray-100"
             onclick="window.location.href='/article?id=${article._id}'">
            <img src="${article.thumbnailUrl || ''}" alt="${article.title || ''}" 
                 class="w-16 h-16 rounded-lg object-cover flex-shrink-0 shadow-md"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzNkMzMC42Mjc0IDM2IDM2IDMwLjYyNzQgMzYgMjRDMzYgMTcuMzcyNiAzMC42Mjc0IDEyIDI0IDEyQzE3LjM3MjYgMTIgMTIgMTcuMzcyNiAxMiAyNEMxMiAzMC42Mjc0IDE3LjM3MjYgMzYgMjQgMzZaIiBmaWxsPSIjREMyNjI2Ii8+CjxwYXRoIGQ9Ik0yMCAxOVYyOUwyOCAyNEwyMCAxOVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo='">
            <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-800 text-base line-clamp-2 mb-1">${article.title || 'No title'}</h4>
                <div class="flex items-center space-x-3 text-sm text-gray-600">
                    <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-medium">${article.category || 'No category'}</span>
                    <span class="professional-numbers">${this.formatDuration(article.duration)}</span>
                    <span class="flex items-center space-x-1">
                        <i class="fas fa-play text-xs"></i>
                        <span class="professional-numbers">${article.plays || 0}</span>
                    </span>
                </div>
            </div>
            <button class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 smooth-transition flex-shrink-0"
                    onclick="event.stopPropagation(); window.articlePage.playRelatedArticle('${article._id}')">
                <i class="fas fa-play text-sm"></i>
            </button>
        </div>
    `).join('');
}

    showRelatedArticlesError() {
        const container = document.getElementById('relatedArticlesList');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-xl mb-2"></i>
                    <p class="text-sm">មិនអាចផ្ទុកអត្ថបទពាក់ព័ន្ធ</p>
                </div>
            `;
        }
    }

formatDuration(seconds) {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    // Return proper format with leading zeros for seconds
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

    showError(message) {
        const articleContent = document.getElementById('articleContent');
        if (articleContent) {
            articleContent.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                    <p class="text-gray-700 text-lg mb-4">${message}</p>
                    <div class="space-y-2 text-sm text-gray-600">
                        <p>សូមពិនិត្យ៖</p>
                        <p>- តើ URL ត្រឹមត្រូវឬទេ?</p>
                        <p>- តើ API server ដំណើរការឬទេ?</p>
                        <p>- តើអត្ថបទនេះមានក្នុងប្រព័ន្ធឬទេ?</p>
                    </div>
                    <a href="/" class="inline-flex items-center space-x-2 brand-bg text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors mt-4">
                        <i class="fas fa-arrow-left"></i>
                        <span>ត្រឡប់ទៅទំព័រដើម</span>
                    </a>
                </div>
            `;
        }
    }
}

// Initialize article page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.articlePage = new ArticlePage();
    });
} else {
    window.articlePage = new ArticlePage();
}