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
        console.log('🔄 Initializing app...');
        await this.loadCategories();
        console.log('📋 Categories loaded:', this.categories.length);
        
        await this.loadArticles();
        this.setupEventListeners();
        this.renderCategories();
        this.renderArticles();
        this.renderNavbarCategories();
        this.renderMobileCategories();
        this.setupDropdownListeners();
        console.log('✅ App initialized');
    }

    async loadCategories() {
        try {
            const url = `${this.apiBase}/categories`;
            console.log('📡 Fetching categories from:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            console.log('📡 Categories data received:', data);
            
            this.categories = data;
            
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
            console.error('❌ Error loading categories:', error);
        }
    }

    async loadArticles(category = null) {
        try {
            let url = `${this.apiBase}/articles`;
            if (category) {
                url += `?category=${encodeURIComponent(category)}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            this.articles = data.articles || [];
            
        } catch (error) {
            console.error('❌ Error loading articles:', error);
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
        }

        // Category filter for chips
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

        categoriesContainer.innerHTML = this.categories.map(category => `
            <button class="category-chip category-filter flex-shrink-0 px-4 py-2 bg-gray-100 text-gray-800 rounded-full hover:bg-blue-100 transition-all duration-300"
                data-category="${this.escapeHtml(category.name)}">
                ${category.name}
            </button>
        `).join('');
    }

renderArticles() {
    const articlesContainer = document.getElementById('articlesContainer');
    if (!articlesContainer) return;

    // Update search results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = this.articles.length;
    }

    if (this.articles.length === 0) {
        const searchInput = document.getElementById('searchInput');
        const isSearching = searchInput && searchInput.value.trim() !== '';
        
        articlesContainer.innerHTML = `
            <div class="col-span-full text-center py-12 no-results">
                <i class="fas fa-${isSearching ? 'search' : 'headphones'} text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-600 mb-2">
                    ${isSearching ? 'រកមិនឃើញអត្ថបទ' : 'គ្មានអត្ថបទទេ'}
                </h3>
                <p class="text-gray-500">
                    ${isSearching ? 
                        'សូមស្វែងរកដោយប្រើពាក្យផ្សេងទៀត' : 
                        'គ្មានអត្ថបទនៅឡើយទេ សូមត្រលប់មកវិញក្រោយ'}
                </p>
                ${isSearching ? `
                    <button onclick="window.audioArticlesApp.clearSearch()" 
                            class="mt-4 brand-bg text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
                        សម្អាតការស្វែងរក
                    </button>
                ` : ''}
            </div>
        `;
        return;
        }

        articlesContainer.innerHTML = this.articles.map(article => `
            <div class="article-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
                 onclick="window.audioArticlesApp.navigateToArticle('${article._id}')">
                <div class="relative">
                    <img src="${article.thumbnailUrl}" alt="${this.escapeHtml(article.title)}" 
                         class="w-full h-48 object-cover">
                    <div class="absolute top-2 right-2">
                        <span class="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm professional-numbers">
                            ${this.formatDuration(article.duration)}
                        </span>
                    </div>
                    <button class="absolute bottom-2 left-2 play-article-btn w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-all"
                            data-article-id="${article._id}"
                            onclick="event.stopPropagation(); window.audioArticlesApp.playArticle('${article._id}')">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="p-4">
                    <span class="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        ${this.escapeHtml(article.category)}
                    </span>
                    <h3 class="font-semibold text-lg mt-2 mb-2 line-clamp-2">${this.escapeHtml(article.title)}</h3>
                    <p class="text-gray-600 text-sm line-clamp-3">${this.escapeHtml(article.description)}</p>
                    <div class="flex justify-between items-center mt-4 text-sm text-gray-500 professional-numbers">
                        <span><i class="fas fa-play mr-1"></i><span class="professional-numbers">${article.plays || 0}</span> plays</span>
                        <span class="professional-numbers">${this.formatDuration(article.duration)}</span>
                        <span class="professional-numbers">${this.formatDate(article.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderNavbarCategories() {
        const navbarCategoriesList = document.getElementById('navbarCategoriesList');
        if (!navbarCategoriesList) {
            console.error('❌ navbarCategoriesList element not found');
            return;
        }
        
        if (!this.categories || this.categories.length === 0) {
            navbarCategoriesList.innerHTML = `
                <div class="px-4 py-3 text-sm text-gray-500 text-center">
                    គ្មានប្រភេទទេ
                </div>
            `;
            return;
        }
        
        console.log('🎯 Rendering navbar categories:', this.categories.length);
        
        navbarCategoriesList.innerHTML = '';
        
        this.categories.forEach(category => {
            const categoryItem = document.createElement('a');
            categoryItem.href = '#';
            categoryItem.className = 'block px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors border-b border-gray-100 last:border-b-0';
            
            categoryItem.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-medium">${category.name}</span>
                    <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full professional-numbers">
                        ${category.articleCount || 0}
                    </span>
                </div>
            `;
            
            categoryItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.filterByCategoryAndClose(category.name);
            });
            
            navbarCategoriesList.appendChild(categoryItem);
        });
    }

    renderMobileCategories() {
        const mobileCategoriesList = document.getElementById('mobileCategoriesList');
        if (!mobileCategoriesList) {
            console.error('❌ mobileCategoriesList element not found');
            return;
        }
        
        if (!this.categories || this.categories.length === 0) {
            mobileCategoriesList.innerHTML = `
                <div class="py-2 text-sm text-gray-500 text-center">
                    គ្មានប្រភេទទេ
                </div>
            `;
            return;
        }
        
        console.log('📱 Rendering mobile categories:', this.categories.length);
        
        mobileCategoriesList.innerHTML = '';
        
        this.categories.forEach(category => {
            const categoryItem = document.createElement('a');
            categoryItem.href = '#';
            categoryItem.className = 'block py-2 text-sm text-gray-600 hover:text-red-600 transition-colors border-b border-gray-100 last:border-b-0';
            
            categoryItem.innerHTML = `
                <div class="flex justify-between items-center">
                    <span>${category.name}</span>
                    <span class="text-xs text-gray-400 professional-numbers">
                        ${category.articleCount || 0}
                    </span>
                </div>
            `;
            
            categoryItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.filterByCategoryAndClose(category.name);
                closeMobileMenu();
            });
            
            mobileCategoriesList.appendChild(categoryItem);
        });
    }

    async filterByCategoryAndClose(categoryName) {
        console.log('🎯 Filtering by category:', categoryName);
        
        // Close desktop dropdown
        const dropdown = document.getElementById('categoriesDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        
        // Filter articles
        await this.filterByCategory(categoryName);
        
        // Show home page
        showPage('home');
    }

    setupDropdownListeners() {
        // Desktop dropdown
        const dropdownBtn = document.getElementById('categoriesDropdownBtn');
        const dropdown = document.getElementById('categoriesDropdown');
        
        if (dropdownBtn && dropdown) {
            dropdownBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });
            
            // Close dropdown when clicking elsewhere
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !dropdownBtn.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
            
            // Prevent dropdown from closing when clicking inside
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Mobile dropdown
        const mobileCategoriesBtn = document.getElementById('mobileCategoriesBtn');
        const mobileCategoriesDropdown = document.getElementById('mobileCategoriesDropdown');
        
        if (mobileCategoriesBtn && mobileCategoriesDropdown) {
            mobileCategoriesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                mobileCategoriesDropdown.classList.toggle('hidden');
                const icon = mobileCategoriesBtn.querySelector('i.fa-chevron-down');
                if (icon) {
                    icon.classList.toggle('rotate-180');
                }
            });
        }
    }

    async filterByCategory(category) {
        console.log('🎯 Filtering articles by category:', category);
        await this.loadArticles(category);
        this.renderArticles();
        
        // Update active category in chips
        document.querySelectorAll('.category-chip').forEach(chip => {
            chip.classList.remove('active', 'bg-blue-500', 'text-white');
            if (chip.dataset.category === category) {
                chip.classList.add('active', 'bg-blue-500', 'text-white');
            }
        });
    }

    navigateToArticle(articleId) {
        console.log('🔄 Navigating to article:', articleId);
        window.location.href = `/article?id=${articleId}`;
    }

    async playArticle(articleId) {
        try {
            const response = await fetch(`${this.apiBase}/articles/${articleId}`);
            this.currentArticle = await response.json();
            
            if (window.audioPlayer) {
                window.audioPlayer.loadArticle(this.currentArticle);
            }
            
            if (!window.location.pathname.includes('/article')) {
                window.location.href = `/article?id=${articleId}`;
            }
        } catch (error) {
            console.error('Error playing article:', error);
        }
    }

            async searchArticles(query) {
    console.log('🔍 Searching for:', query || '(empty - show all)');
    
    try {
        const searchUrl = `${this.apiBase}/articles/search?q=${encodeURIComponent(query || '')}`;
        console.log('📡 Search URL:', searchUrl);
        
        const response = await fetch(searchUrl);
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📡 Search results:', data.articles.length, 'articles found');
        
        // Update articles with search results
        this.articles = data.articles || [];
        
        // Update UI
        this.renderArticles();
        
        // Update search info display
        this.updateSearchUI(query || '', this.articles.length);
        
    } catch (error) {
        console.error('❌ Search error:', error);
        // Fallback to local filtering
        this.filterArticlesLocally(query || '');
        this.renderArticles();
        this.updateSearchUI(query || '', this.articles.length);
    }
}

// Fix the updateSearchUI method
updateSearchUI(query, resultsCount) {
    const searchInput = document.getElementById('searchInput');
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    const resultsCountElement = document.getElementById('resultsCount');
    const clearSearchButton = document.getElementById('clearSearchButton');
    
    // Get current search input value
    const currentSearchValue = searchInput ? searchInput.value.trim() : '';
    
    // Only update input if we're explicitly setting a query
    if (searchInput && query !== undefined) {
        searchInput.value = query;
    }
    
    // Show/hide clear button based on actual input
    if (clearSearchButton) {
        const hasInput = currentSearchValue !== '' || (query && query.trim() !== '');
        if (hasInput) {
            clearSearchButton.classList.remove('hidden');
        } else {
            clearSearchButton.classList.add('hidden');
        }
    }
    
    // Show/hide results info - ONLY when user is actively searching
    if (searchResultsInfo && resultsCountElement) {
        const isSearching = currentSearchValue !== '' || (query && query.trim() !== '');
        
        if (isSearching) {
            searchResultsInfo.classList.remove('hidden');
            resultsCountElement.textContent = resultsCount;
        } else {
            searchResultsInfo.classList.add('hidden');
        }
    }
    
    console.log('🔍 Search UI updated:', { query, resultsCount, isSearching: query && query.trim() !== '' });
}

// Add this method if it doesn't exist, or replace if it does:
clearSearch() {
    console.log('🗑️ Clearing search');
    
    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Hide search info
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    if (searchResultsInfo) {
        searchResultsInfo.classList.add('hidden');
    }
    
    // Hide clear button
    const clearSearchButton = document.getElementById('clearSearchButton');
    if (clearSearchButton) {
        clearSearchButton.classList.add('hidden');
    }
    
    // Load all articles
    if (this.allArticles && this.allArticles.length > 0) {
        this.articles = [...this.allArticles];
        this.renderArticles();
    } else {
        this.loadArticles().then(() => {
            this.renderArticles();
        });
    }
    
    // Remove any active category filters
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.remove('active', 'bg-blue-500', 'text-white');
    });
}

filterArticlesLocally(query) {
    console.log('🔍 Filtering articles locally for:', query);
    
    // Make sure we have all articles stored
    if (!this.allArticles) {
        this.allArticles = [...this.articles];
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    if (searchTerm === '') {
        this.articles = [...this.allArticles];
        return;
    }
    
    this.articles = this.allArticles.filter(article => {
        if (!article) return false;
        
        const titleMatch = article.title && article.title.toLowerCase().includes(searchTerm);
        const descMatch = article.description && article.description.toLowerCase().includes(searchTerm);
        const categoryMatch = article.category && article.category.toLowerCase().includes(searchTerm);
        
        return titleMatch || descMatch || categoryMatch;
    });
    
    console.log('✅ Found', this.articles.length, 'articles');
}


// Update your handleSearch method:
handleSearch(e) {
    const searchTerm = e.target.value.trim();
    this.searchArticles(searchTerm);
}



// Update your init method to store all articles
async init() {
    console.log('🔄 Initializing app...');
    await this.loadCategories();
    console.log('📋 Categories loaded:', this.categories.length);
    
    await this.loadArticles();
    // Store all articles for search
    this.allArticles = [...this.articles];
    
    this.setupEventListeners();
    this.renderCategories();
    this.renderArticles();
    this.renderNavbarCategories();
    this.renderMobileCategories();
    this.setupDropdownListeners();
    console.log('✅ App initialized');
}

    // Utility methods
    formatDuration(seconds) {
        if (!seconds || seconds === 0 || isNaN(seconds)) {
            return '0m 00s';
        }
        
        seconds = Number(seconds);
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

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        console.log('Searching for:', searchTerm);
        // Add search logic here
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.audioArticlesApp = new AudioArticlesApp();
});