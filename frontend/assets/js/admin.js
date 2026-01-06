// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('adminToken');
        this.currentUser = null;
        
        // Get API base with fallback
        if (window.appConfig && window.appConfig.apiBase) {
            this.apiBase = window.appConfig.apiBase;
        } else {
            // Fallback for development
            this.apiBase = 'http://localhost:5000/api';
            console.warn('⚠️ appConfig not found, using fallback API:', this.apiBase);
        }
        
        this.init();
    }

async init() {
    await this.checkAuth();
    if (this.currentUser) {
        this.setupEventListeners();
        await this.loadDashboardData();
        
        // ALWAYS load categories for all admin pages
        await this.loadCategories();
    }
}

    async checkAuth() {
        if (!this.token) {
            this.redirectToLogin();
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Not authenticated');
            }

            const data = await response.json();
            this.currentUser = data.user;
            this.updateUI();
        } catch (error) {
            console.error('Auth check failed:', error);
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
    }

    updateUI() {
        const userElement = document.getElementById('currentUser');
        if (userElement) {
            userElement.textContent = this.currentUser.username;
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Article form submission
        const articleForm = document.getElementById('articleForm');
        if (articleForm) {
            articleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleArticleSubmit(e);
            });
        }

        // Category form submission
        const categoryForm = document.getElementById('categoryForm');
        console.log('Category form element:', categoryForm);
        
        if (categoryForm) {
            // Add click listener to the button directly
            const button = categoryForm.querySelector('button[type="submit"]');
            if (button) {
                console.log('Adding click listener to submit button');
                button.addEventListener('click', (e) => {
                    console.log('BUTTON CLICKED!');
                    e.preventDefault();
                    this.createCategory();
                });
            }
            
            // Keep form listener as backup
            categoryForm.addEventListener('submit', (e) => {
                console.log('FORM SUBMIT EVENT!');
                e.preventDefault();
                this.createCategory();
            });
        }

        // File input handlers
        const audioFileInput = document.getElementById('audioFile');
        const thumbnailInput = document.getElementById('thumbnail');

        if (audioFileInput) {
            audioFileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                const audioFileInfo = document.getElementById('audioFileInfo');
                if (file && audioFileInfo) {
                    audioFileInfo.textContent = `✅ ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
                    audioFileInfo.className = 'mt-2 text-sm text-green-600';
                }
            });
        }

        if (thumbnailInput) {
            thumbnailInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                const preview = document.getElementById('thumbnailPreview');
                if (file && preview) {
                    preview.innerHTML = `
                        <div class="text-green-600 text-sm mb-2">✅ ${file.name}</div>
                        <img src="${URL.createObjectURL(file)}" class="h-20 w-20 object-cover rounded mx-auto">
                    `;
                }
            });
        }

        // Article edit/delete buttons (delegated events for dynamic content)
        document.addEventListener('click', (e) => {
            // Edit article
            if (e.target.closest('.edit-article')) {
                const articleId = e.target.closest('.edit-article').dataset.id;
                this.editArticle(articleId);
            }
            
            // Delete article
            if (e.target.closest('.delete-article')) {
                const articleId = e.target.closest('.delete-article').dataset.id;
                this.deleteArticle(articleId);
            }
        });
    }

    logout() {
        localStorage.removeItem('adminToken');
        this.redirectToLogin();
    }

    // ARTICLE METHODS
async handleArticleSubmit(e) {
    e.preventDefault();
    console.log('Article form submitted');

    // Show loading indicator
    this.showLoading();

    const formData = new FormData();
    
    // Get form values
    formData.append('title', document.getElementById('title').value);
    formData.append('category', document.getElementById('category').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('published', document.getElementById('published').checked);
    formData.append('featured', document.getElementById('featured').checked);
    formData.append('content', 'Audio book content');
    
    // REMOVE THIS: formData.append('duration', '300');
    // Let backend calculate actual duration from audio file
    
    // Get files
    const audioFile = document.getElementById('audioFile').files[0];
    const thumbnailFile = document.getElementById('thumbnail').files[0];
    
    if (audioFile) formData.append('audio', audioFile);
    if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

        try {
            const response = await fetch(`${this.apiBase}/articles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.ok) {
                const newArticle = await response.json();
                
                // Hide loading and show success
                this.hideLoading();
                this.showSuccess();
                
                // Clear form after successful upload
                setTimeout(() => {
                    document.getElementById('articleForm').reset();
                    // Clear file previews
                    document.getElementById('audioFileInfo').textContent = '';
                    document.getElementById('thumbnailPreview').innerHTML = '';
                }, 2000);
                
            } else {
                const error = await response.json();
                this.hideLoading();
                alert(`Error uploading article: ${error.error}`);
            }
        } catch (error) {
            console.error('Error uploading article:', error);
            this.hideLoading();
            alert('Error uploading article. Please try again.');
        }
    }

// Edit article method - OPEN MODAL
async editArticle(articleId) {
    console.log('Edit article called:', articleId);
    
    try {
        // Show loading
        this.showLoading();

        // Fetch article data
        const articleResponse = await fetch(`${this.apiBase}/articles/${articleId}`);
        const article = await articleResponse.json();
        
        console.log('Article data received:', article); // DEBUG

        // Fetch categories
        const categoriesResponse = await fetch(`${this.apiBase}/categories`);
        const categories = await categoriesResponse.json();

        this.hideLoading();

        if (!article) {
            alert('Article not found');
            return;
        }

        // Populate modal fields
        this.populateEditModal(article, categories);
        
    } catch (error) {
        this.hideLoading();
        console.error('Error loading article for edit:', error);
        alert('Error loading article data');
    }
}

// Populate edit modal with data - FIXED VERSION
populateEditModal(article, categories) {
    // Add this at the beginning of populateEditModal
console.log('=== DEBUG ARTICLE DATA ===');
console.log('Title:', article.title);
console.log('Description:', article.description);
console.log('Category:', article.category);
console.log('Thumbnail URL:', article.thumbnailUrl);
console.log('Published:', article.published);
console.log('Featured:', article.featured);
console.log('=== END DEBUG ===');
    console.log('Populating modal with:', article);
    
    // Set article ID
    document.getElementById('editArticleId').value = article._id;
    
    // Set basic fields - FIXED: Use correct field names
    document.getElementById('editArticleTitle').value = article.title || '';
    document.getElementById('editArticleDescription').value = article.description || '';
    document.getElementById('editArticlePublished').checked = article.published || false;
    document.getElementById('editArticleFeatured').checked = article.featured || false;
    
    // Set current thumbnail
    const currentThumbnailImg = document.getElementById('editArticleCurrentThumbnail');
    if (article.thumbnailUrl) {
        currentThumbnailImg.src = article.thumbnailUrl;
        currentThumbnailImg.alt = article.title || 'Article thumbnail';
        currentThumbnailImg.classList.remove('hidden');
    } else {
        currentThumbnailImg.src = '';
        currentThumbnailImg.alt = 'No thumbnail';
    }
    
    // Populate categories dropdown - FIXED: Make sure category is selected
    const categorySelect = document.getElementById('editArticleCategory');
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        
        // Check if this category matches the article's category
        if (category.name === article.category) {
            option.selected = true;
            console.log('Selected category:', category.name); // DEBUG
        }
        
        categorySelect.appendChild(option);
    });

    // Clear new thumbnail preview
    document.getElementById('editArticleThumbnailPreview').innerHTML = '';
    document.getElementById('editArticleThumbnail').value = '';

    // Show modal
    document.getElementById('editArticleModal').classList.remove('hidden');
    
    // Setup modal event listeners
    this.setupEditArticleModalListeners();
}

// Populate edit modal with data
populateEditModal(article, categories) {
    console.log('Populating edit modal with article:', article);
    
    // Set article ID
    document.getElementById('editArticleId').value = article._id;
    
    // Set basic fields
    document.getElementById('editArticleTitle').value = article.title || '';
    document.getElementById('editArticleDescription').value = article.description || '';
    document.getElementById('editArticlePublished').checked = article.published || false;
    document.getElementById('editArticleFeatured').checked = article.featured || false;
    
// Set current thumbnail - IMPROVED VERSION
const currentThumbnailImg = document.getElementById('editArticleCurrentThumbnail');
const noThumbnailMessage = document.getElementById('noThumbnailMessage');

if (article.thumbnailUrl) {
    currentThumbnailImg.src = article.thumbnailUrl;
    currentThumbnailImg.alt = article.title || 'Article thumbnail';
    currentThumbnailImg.classList.remove('hidden');
    noThumbnailMessage.classList.add('hidden');
} else {
    currentThumbnailImg.classList.add('hidden');
    noThumbnailMessage.classList.remove('hidden');
}
    
    // Populate categories dropdown
    const categorySelect = document.getElementById('editArticleCategory');
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        option.selected = category.name === article.category;
        categorySelect.appendChild(option);
    });

    // Clear thumbnail preview
    document.getElementById('editArticleThumbnailPreview').innerHTML = '';
    document.getElementById('editArticleThumbnail').value = '';

    // Show modal
    document.getElementById('editArticleModal').classList.remove('hidden');
    
    // Setup modal event listeners
    this.setupEditArticleModalListeners();
}

// Setup edit article modal listeners
setupEditArticleModalListeners() {
    // Close modal buttons
    const closeButtons = [
        document.getElementById('closeEditArticleModal'),
        document.getElementById('cancelEditArticle')
    ];
    
    closeButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                this.closeEditArticleModal();
            });
        }
    });

    // Edit form submission
    const editForm = document.getElementById('editArticleForm');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateArticle();
        });
    }

    // Thumbnail change handler
    const thumbnailInput = document.getElementById('editArticleThumbnail');
    if (thumbnailInput) {
        thumbnailInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('editArticleThumbnailPreview');
            if (file && preview) {
                preview.innerHTML = `
                    <div class="text-green-600 text-sm mb-2">✅ New: ${file.name}</div>
                    <img src="${URL.createObjectURL(file)}" class="h-20 w-20 object-cover rounded mx-auto">
                `;
            }
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('editArticleModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEditArticleModal();
            }
        });
    }
}

// Close edit article modal
closeEditArticleModal() {
    document.getElementById('editArticleModal').classList.add('hidden');
}

// Update article method
async updateArticle() {
    const articleId = document.getElementById('editArticleId').value;
    const title = document.getElementById('editArticleTitle').value.trim();
    const description = document.getElementById('editArticleDescription').value.trim();
    const category = document.getElementById('editArticleCategory').value;
    const published = document.getElementById('editArticlePublished').checked;
    const featured = document.getElementById('editArticleFeatured').checked;
    const newThumbnail = document.getElementById('editArticleThumbnail').files[0];

    if (!title || !description || !category) {
        alert('Please fill in all required fields');
        return;
    }

    // Show loading
    this.showLoading();

    try {
        const formData = new FormData();
        
        // Add basic fields
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('published', published);
        formData.append('featured', featured);
        
        // Add new thumbnail if provided
        if (newThumbnail) {
            formData.append('thumbnail', newThumbnail);
        }

        const response = await fetch(`${this.apiBase}/articles/${articleId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        this.hideLoading();

        if (response.ok) {
            const updatedArticle = await response.json();
            alert('Article updated successfully!');
            this.closeEditArticleModal();
            this.loadDashboardData(); // Refresh the table
        } else {
            const error = await response.json();
            alert(`Error updating article: ${error.error}`);
        }
    } catch (error) {
        this.hideLoading();
        console.error('Error updating article:', error);
        alert('Error updating article. Please try again.');
    }
}

    // Delete article method
    async deleteArticle(articleId) {
        if (!confirm('Are you sure you want to delete this article? This will also delete the audio file and thumbnail from Cloudinary.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/articles/${articleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                alert('Article deleted successfully!');
                this.loadDashboardData(); // Refresh the table
            } else {
                const error = await response.json();
                alert(`Error deleting article: ${error.error}`);
            }
        } catch (error) {
            console.error('Error deleting article:', error);
            alert('Error deleting article');
        }
    }

    // Loading and success methods
    showLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }

    showSuccess() {
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.classList.remove('hidden');
        }
    }

    hideSuccessMessage() {
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.classList.add('hidden');
        }
    }

    // CATEGORY METHODS
    async createCategory() {
        console.log('createCategory method called!');
        
        const nameInput = document.getElementById('categoryName');
        const descriptionInput = document.getElementById('categoryDescription');
        
        console.log('Input values:', {
            name: nameInput?.value,
            description: descriptionInput?.value
        });
        
        if (!nameInput || !descriptionInput) {
            console.error('Form inputs not found!');
            alert('Form inputs not found!');
            return;
        }
        
        const categoryData = {
            name: nameInput.value.trim(),
            description: descriptionInput.value.trim()
        };

        if (!categoryData.name) {
            alert('Please enter a category name');
            return;
        }

        console.log('Sending category data:', categoryData);

        try {
            const response = await fetch(`${this.apiBase}/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(categoryData)
            });

            console.log('Response status:', response.status);
            
            if (response.ok) {
                const newCategory = await response.json();
                console.log('Category created successfully:', newCategory);
                alert('Category created successfully!');
                
                // Clear form
                nameInput.value = '';
                descriptionInput.value = '';
                
                // Reload categories list
                this.loadCategories();
            } else {
                const error = await response.json();
                console.error('Error response:', error);
                alert(`Error creating category: ${error.error}`);
            }
        } catch (error) {
            console.error('Error creating category:', error);
            alert('Error creating category. Please try again.');
        }
    }

        async loadCategories() {
    console.log('Loading categories...');
    try {
        const response = await fetch(`${this.apiBase}/categories`);
        
        if (!response.ok) {
            throw new Error(`Failed to load categories: ${response.status}`);
        }
        
        const categories = await response.json();
        console.log('Categories loaded:', categories);
        
        // Render in categories list (manage-categories page)
        if (window.location.pathname.includes('/manage-categories')) {
            this.renderCategories(categories);
        }
        
        // Render in dropdown (upload page)
        if (window.location.pathname.includes('/upload')) {
            this.renderCategoryDropdown(categories);
        }
        
        // Return categories so other methods can use them
        return categories;
        
    } catch (error) {
        console.error('Error loading categories:', error);
        // Return empty array to prevent crashes
        return [];
    }
}

    renderCategories(categories) {
        const categoriesList = document.getElementById('categoriesList');
        console.log('Rendering categories to:', categoriesList);
        
        if (!categoriesList) {
            console.error('Categories list element not found!');
            return;
        }

        if (categories.length === 0) {
            categoriesList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-folder-open text-4xl mb-3"></i>
                    <p>No categories found. Add your first category above.</p>
                </div>
            `;
        } else {
            categoriesList.innerHTML = categories.map(category => `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <h3 class="font-semibold text-gray-800">${category.name}</h3>
                        ${category.description ? `<p class="text-gray-600 text-sm mt-1">${category.description}</p>` : ''}
                        <p class="text-xs text-gray-500 mt-1">${category.articleCount || 0} articles</p>
                    </div>
                    <div class="flex space-x-2">
                        <button class="text-blue-600 hover:text-blue-800 p-2" onclick="adminPanel.editCategory('${category._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-600 hover:text-red-800 p-2" onclick="adminPanel.deleteCategory('${category._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    async deleteCategory(categoryId) {
        console.log('Delete category called:', categoryId);
        
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/categories/${categoryId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('Delete response status:', response.status);
            
            if (response.ok) {
                alert('Category deleted successfully!');
                this.loadCategories();
            } else {
                const error = await response.json();
                console.error('Delete error:', error);
                alert(`Error deleting category: ${error.error}`);
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error deleting category');
        }
    }

    // Render categories in dropdown
    renderCategoryDropdown(categories) {
        const categorySelect = document.getElementById('category');
        if (!categorySelect) return;

        console.log('Rendering categories in dropdown:', categories);

        // Clear existing options except the first one
        while (categorySelect.options.length > 1) {
            categorySelect.remove(1);
        }

        // Add categories to dropdown
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    }

    // EDIT CATEGORY METHODS
    editCategory(categoryId) {
        console.log('Edit category called:', categoryId);
        this.openEditModal(categoryId);
    }

    async openEditModal(categoryId) {
        try {
            // Fetch category data
            const response = await fetch(`${this.apiBase}/categories`);
            const categories = await response.json();
            const category = categories.find(cat => cat._id === categoryId);
            
            if (!category) {
                alert('Category not found');
                return;
            }

            // Populate modal fields
            document.getElementById('editCategoryId').value = category._id;
            document.getElementById('editCategoryName').value = category.name;
            document.getElementById('editCategoryDescription').value = category.description || '';

            // Show modal
            document.getElementById('editCategoryModal').classList.remove('hidden');
            
            // Setup modal event listeners
            this.setupEditModalListeners();
        } catch (error) {
            console.error('Error loading category for edit:', error);
            alert('Error loading category data');
        }
    }

    setupEditModalListeners() {
        // Close modal buttons
        const closeButtons = [
            document.getElementById('closeEditModal'),
            document.getElementById('cancelEdit')
        ];
        
        closeButtons.forEach(button => {
            if (button) {
                button.addEventListener('click', () => {
                    this.closeEditModal();
                });
            }
        });

        // Edit form submission
        const editForm = document.getElementById('editCategoryForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateCategory();
            });
        }

        // Close modal when clicking outside
        const modal = document.getElementById('editCategoryModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeEditModal();
                }
            });
        }
    }

    closeEditModal() {
        document.getElementById('editCategoryModal').classList.add('hidden');
    }

    async updateCategory() {
        const categoryId = document.getElementById('editCategoryId').value;
        const name = document.getElementById('editCategoryName').value.trim();
        const description = document.getElementById('editCategoryDescription').value.trim();

        if (!name) {
            alert('Please enter a category name');
            return;
        }

        const categoryData = {
            name,
            description
        };

        try {
            const response = await fetch(`${this.apiBase}/categories/${categoryId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(categoryData)
            });

            if (response.ok) {
                alert('Category updated successfully!');
                this.closeEditModal();
                this.loadCategories(); // Refresh the list
            } else {
                const error = await response.json();
                alert(`Error updating category: ${error.error}`);
            }
        } catch (error) {
            console.error('Error updating category:', error);
            alert('Error updating category. Please try again.');
        }
    }

        async loadDashboardData() {
    try {
        if (!window.location.pathname.includes('/admin')) {
            return;
        }

        // Load both articles and categories in parallel
        const [articlesRes, categoriesRes] = await Promise.all([
            fetch(`${this.apiBase}/articles?limit=100`),
            fetch(`${this.apiBase}/categories`)
        ]);

        if (!articlesRes.ok || !categoriesRes.ok) {
            throw new Error('Failed to fetch data');
        }

        const articlesData = await articlesRes.json();
        const categoriesData = await categoriesRes.json();

        // Update dashboard stats
        this.renderDashboard(articlesData, categoriesData);
        
        // Render articles table
        if (window.location.pathname === '/admin') {
            this.renderArticlesTable(articlesData.articles);
        }
        
        // Make categories available globally if needed
        window.currentCategories = categoriesData;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

    renderDashboard(articlesData, categoriesData) {
        const totalArticles = articlesData.total || articlesData.articles?.length || 0;
        const totalPlays = articlesData.articles?.reduce((sum, article) => sum + (article.plays || 0), 0) || 0;
        
        const totalArticlesEl = document.getElementById('totalArticles');
        const totalPlaysEl = document.getElementById('totalPlays');
        const totalCategoriesEl = document.getElementById('totalCategories');
        
        if (totalArticlesEl) totalArticlesEl.textContent = totalArticles;
        if (totalPlaysEl) totalPlaysEl.textContent = totalPlays;
        if (totalCategoriesEl) totalCategoriesEl.textContent = categoriesData.length || 0;
    }

    renderArticlesTable(articles) {
        const tableBody = document.getElementById('articlesTableBody');
        if (!tableBody) return;
        
        if (!articles || articles.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        No articles found. <a href="/upload" class="text-blue-500 hover:text-blue-600">Upload your first article</a>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = articles.slice(0, 10).map(article => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-lg object-cover" src="${article.thumbnailUrl}" alt="${article.title}">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${article.title}</div>
                            <div class="text-sm text-gray-500">${new Date(article.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        ${article.category}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${article.plays || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${this.formatDuration(article.duration)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${article.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${article.published ? 'Published' : 'Draft'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-3 edit-article" data-id="${article._id}">
                        <i class="fas fa-edit mr-1"></i>Edit
                    </button>
                    <button class="text-red-600 hover:text-red-900 delete-article" data-id="${article._id}">
                        <i class="fas fa-trash mr-1"></i>Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AdminPanel...');
    if (window.location.pathname.includes('/admin') || 
        window.location.pathname.includes('/upload') ||
        window.location.pathname.includes('/manage-categories')) {
        window.adminPanel = new AdminPanel();
    }
});

// Global function for success message
function hideSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.classList.add('hidden');
    }
}