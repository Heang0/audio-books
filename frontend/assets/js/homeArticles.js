// Homepage Articles Functionality
class HomeArticles {
    constructor() {
        this.apiBase = window.appConfig.apiBase;
        this.articles = [];
        this.init();
    }

    async init() {
        await this.loadArticles();
        this.setupModal();
    }

    async loadArticles() {
        try {
            const response = await fetch(`${this.apiBase}/articles?limit=12&page=1`);
            const data = await response.json();
            
            if (response.ok) {
                this.articles = data.articles || [];
                this.renderArticles();
            } else {
                this.showError('កំហុសក្នុងការផ្ទុកអត្ថបទ');
            }
        } catch (error) {
            console.error('Error loading articles:', error);
            this.showError('កំហុសក្នុងការផ្ទុកអត្ថបទ');
        }
    }

    renderArticles() {
        const container = document.getElementById('articlesContainer');
        if (!container) return;

        if (this.articles.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <i class="fas fa-newspaper text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">មិនមានអត្ថបទ</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.articles.map(article => `
            <div class="article-card bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg"
                 data-article-id="${article._id}"
                 onclick="homeArticles.showArticleModal('${article._id}')">
                <div class="relative">
                    <img src="${article.thumbnailUrl}" 
                         alt="${article.title}"
                         class="w-full h-48 object-cover hover:scale-105 transition-transform duration-300">
                    <div class="absolute top-2 left-2">
                        <span class="text-xs font-semibold text-white bg-blue-600 px-2 py-1 rounded">
                            ${article.category}
                        </span>
                    </div>
                    <div class="absolute bottom-2 right-2">
                        <span class="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                            <i class="fas fa-play mr-1"></i>${article.plays || 0}
                        </span>
                    </div>
                </div>
                
                <div class="p-4">
                    <h3 class="font-semibold text-gray-800 mb-2 line-clamp-2 hover:text-red-600 transition-colors">
                        ${article.title}
                    </h3>
                    <p class="text-gray-600 text-sm line-clamp-3">
                        ${article.description || 'មិនមានការពិពណ៌នា'}
                    </p>
                    <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <span class="text-xs text-gray-500">
                            ${new Date(article.createdAt).toLocaleDateString('km-KH')}
                        </span>
                        <span class="text-xs text-gray-500">
                            ${this.formatDuration(article.duration)}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    setupModal() {
        // Modal close button
        const modalClose = document.getElementById('modalClose');
        const modal = document.getElementById('imageModal');
        const modalPlayBtn = document.getElementById('modalPlayBtn');

        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal();
            });
        }

        if (modalPlayBtn) {
            modalPlayBtn.addEventListener('click', () => {
                this.playArticle();
            });
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hideModal();
        });
    }

    showArticleModal(articleId) {
        const article = this.articles.find(a => a._id === articleId);
        if (!article) return;

        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        const modalDescription = document.getElementById('modalDescription');
        const modalPlayBtn = document.getElementById('modalPlayBtn');

        if (modalImage) modalImage.src = article.thumbnailUrl;
        if (modalImage) modalImage.alt = article.title;
        if (modalTitle) modalTitle.textContent = article.title;
        if (modalDescription) modalDescription.textContent = article.description || 'មិនមានការពិពណ៌នា';
        if (modalPlayBtn) modalPlayBtn.dataset.articleId = article._id;

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        const modal = document.getElementById('imageModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    playArticle() {
        const modalPlayBtn = document.getElementById('modalPlayBtn');
        const articleId = modalPlayBtn.dataset.articleId;
        
        if (articleId) {
            // Navigate to article page
            window.location.href = `/article.html?id=${articleId}`;
        }
        
        this.hideModal();
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
    showError(message) {
        const container = document.getElementById('articlesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                    <p class="text-gray-700 text-lg mb-4">${message}</p>
                    <button onclick="homeArticles.loadArticles()" class="brand-bg text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
                        ព្យាយាមម្តងទៀត
                    </button>
                </div>
            `;
        }
    }
}

// Initialize home articles
const homeArticles = new HomeArticles();