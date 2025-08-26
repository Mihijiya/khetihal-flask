document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: Script loaded.');

    // --- Global Variables ---
    let simulatedOtp = ''; // To store the generated OTP for demonstration
    let isAdminUser = false; 
    let isLoggedIn = false; // New global variable to track login status

    // --- Utility Functions ---

    // Function to check login status (could be more robust with a dedicated API endpoint)
    // For now, we'll infer it from the presence of the profile dropdown button.
    async function checkLoginStatus() {
        try {
            const response = await fetch('/api/check_login_status'); // Assuming you have this endpoint
            const data = await response.json();
            isLoggedIn = data.is_logged_in;
        } catch (error) {
            console.error('Error checking login status:', error);
            isLoggedIn = false; // Default to not logged in on error
        }
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Helper function to display messages for forms/general alerts
    function displayMessage(message, type, targetElementId = 'formMessages') {
        const messageContainer = document.getElementById(targetElementId);
        if (!messageContainer) {
            console.warn(`displayMessage: Target element with ID '${targetElementId}' not found for displaying messages.`);
            console.log(`displayMessage: Message: ${message}, Type: ${type}`); // Fallback to console log if container not found
            return;
        }

        // Clear existing timeout if any, to allow new messages to display fully
        clearTimeout(messageContainer.dataset.timeoutId);

        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`; // Using 'message' class from CSS
        messageContainer.style.display = 'block';
        messageContainer.style.opacity = '1'; // Ensure it's visible if CSS sets opacity to 0

        const timeoutId = setTimeout(() => {
            messageContainer.style.opacity = '0'; // Fade out
            // After fading, hide completely to not block layout
            messageContainer.addEventListener('transitionend', function handler() {
                messageContainer.style.display = 'none';
                messageContainer.textContent = ''; // Clear text after hiding
                messageContainer.removeEventListener('transitionend', handler);
            }, { once: true }); // Ensure handler runs only once
        }, 5000); // Hide after 5 seconds

        messageContainer.dataset.timeoutId = timeoutId; // Store timeout ID
        console.log(`displayMessage: Message displayed: "${message}" (${type}) in #${targetElementId}`);
    }

    // Function to show the loading overlay with dynamic content
    function showLoadingOverlay(message = 'Loading...', iconType = 'spinner') {
        console.log('showLoadingOverlay function called.'); 
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingOverlayContent = loadingOverlay ? loadingOverlay.querySelector('.loading-overlay-content') : null;
        const loadingMessageElement = loadingOverlay ? loadingOverlay.querySelector('#loadingMessage') : null; // Specific element for message

        if (!loadingOverlay || !loadingOverlayContent || !loadingMessageElement) {
            console.warn('showLoadingOverlay: Required overlay elements not found.');
            return;
        }

        // Clear previous content and set new content based on iconType
        loadingOverlayContent.innerHTML = ''; // Clear existing spinner/icon

        if (iconType === 'spinner') {
            loadingOverlayContent.innerHTML = '<div class="loading-spinner"></div>';
        } else if (iconType === 'success') {
            loadingOverlayContent.innerHTML = '<i class="bi bi-check-circle-fill success-icon"></i>';
            // No need for setTimeout here, CSS transition will handle it
        } else if (iconType === 'error') {
            loadingOverlayContent.innerHTML = '<i class="bi bi-x-circle-fill error-icon"></i>';
            // No need for setTimeout here, CSS transition will handle it
        }

        loadingMessageElement.textContent = message; // Update the message

        loadingOverlay.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        console.log(`Loading overlay shown with type: ${iconType}, message: "${message}"`);
    }

    // Function to hide the loading overlay (can also display a final message briefly)
    function hideLoadingOverlay(finalMessage = '', finalType = 'info', duration = 1500) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingMessageElement = loadingOverlay ? loadingOverlay.querySelector('#loadingMessage') : null;
        const loadingOverlayContent = loadingOverlay ? loadingOverlay.querySelector('.loading-overlay-content') : null;

        if (!loadingOverlay || !loadingMessageElement || !loadingOverlayContent) {
            console.warn('hideLoadingOverlay: Required overlay elements not found.');
            return;
        }

        // Display final message and icon before fading out
        if (finalMessage) {
            loadingMessageElement.textContent = finalMessage;
            loadingOverlayContent.innerHTML = ''; // Clear spinner
            if (finalType === 'success') {
                loadingOverlayContent.innerHTML = '<i class="bi bi-check-circle-fill success-icon"></i>';
            } else if (finalType === 'error') {
                loadingOverlayContent.innerHTML = '<i class="bi bi-x-circle-fill error-icon"></i>';
            }
        }

        setTimeout(() => {
            loadingOverlay.classList.remove('show');
            document.body.style.overflow = ''; // Restore scrolling
            // Clear content after transition
            setTimeout(() => {
                loadingMessageElement.textContent = '';
                loadingOverlayContent.innerHTML = '';
            }, 300); // Match CSS transition duration for overlay fade
            console.log('Loading overlay hidden.');
        }, finalMessage ? duration : 0); // Keep visible for duration if final message, else hide immediately
    }

    // --- NEW: Login Required Modal Functions ---
    const loginRequiredModal = document.getElementById('loginRequiredModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalLoginBtn = document.getElementById('modalLoginBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCloseX = loginRequiredModal ? loginRequiredModal.querySelector('.close-button') : null;

    function showLoginRequiredModal(message) {
        if (loginRequiredModal && modalMessage) {
            modalMessage.textContent = message;
            loginRequiredModal.style.display = 'flex'; // Use flex to center content
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    function hideLoginRequiredModal() {
        if (loginRequiredModal) {
            loginRequiredModal.style.display = 'none';
            document.body.style.overflow = ''; // Restore background scrolling
        }
    }

    // Attach event listeners for the modal buttons
    if (modalLoginBtn) {
        modalLoginBtn.addEventListener('click', () => {
            hideLoginRequiredModal();
            window.location.href = 'login.html'; // Redirect to login page
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideLoginRequiredModal);
    }

    if (modalCloseX) {
        modalCloseX.addEventListener('click', hideLoginRequiredModal);
    }

    // Close modal if clicking outside the content
    if (loginRequiredModal) {
        loginRequiredModal.addEventListener('click', (event) => {
            if (event.target === loginRequiredModal) {
                hideLoginRequiredModal();
            }
        });
    }
    // --- END NEW: Login Required Modal Functions ---


    // Generic AJAX form submission handler
    async function handleFormSubmission(event, endpoint, redirectUrl = null, messageTargetId = 'formMessages') {
        event.preventDefault();
        console.log(`handleFormSubmission: Attempting to submit form to ${endpoint}`);

        const form = event.target;
        const formData = new FormData(form);
        const formMessagesElementId = messageTargetId; // Use provided messageTargetId

        // Show loading overlay immediately when the button is clicked
        showLoadingOverlay('Processing...', 'spinner'); 
        displayMessage('Processing...', 'info', formMessagesElementId);

        // Log form data for debugging
        for (let pair of formData.entries()) {
            console.log(`FormData: ${pair[0]}: ${pair[1]}`);
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            console.log('handleFormSubmission: HTTP Response Status:', response.status, response.statusText);

            // Check if the response is OK (2xx status) before trying to parse JSON
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                    console.error('handleFormSubmission: Server responded with non-OK status, parsed JSON error:', errorData);
                    hideLoadingOverlay(errorData.message || 'An unexpected server error occurred.', 'error');
                    displayMessage(`Error: ${errorData.message || 'An unexpected server error occurred.'}`, 'error', formMessagesElementId);
                } catch (jsonError) {
                    const errorText = await response.text();
                    console.error('handleFormSubmission: Server responded with non-OK status, failed to parse JSON, raw text:', errorText);
                    hideLoadingOverlay(`Server error (${response.status})`, 'error');
                    displayMessage(`Server error (${response.status}): ${errorText.substring(0, 100)}...`, 'error', formMessagesElementId);
                }
                return;
            }

            const responseText = await response.text();
            console.log('handleFormSubmission: Raw Server Response:', responseText);

            let result;
            try {
                result = JSON.parse(responseText);
                console.log('handleFormSubmission: Parsed JSON Response:', result);
            } catch (jsonParseError) {
                console.error('handleFormSubmission: JSON parsing error:', jsonParseError);
                console.error('handleFormSubmission: Response was not valid JSON:', responseText);
                hideLoadingOverlay('Received invalid response.', 'error');
                displayMessage('Received invalid response from server. Check console for details.', 'error', formMessagesElementId);
                return;
            }

            if (result.success) {
                hideLoadingOverlay(result.message, 'success');
                displayMessage(result.message, 'success', formMessagesElementId);
                console.log(`handleFormSubmission: Form submission successful. Message: ${result.message}`);
                // Only reset form if no redirect, or if it's a final submission
                if (!result.redirect && !redirectUrl) {
                    form.reset();
                }
                if (result.redirect) {
                    console.log(`handleFormSubmission: Redirecting to ${result.redirect}`);
                    setTimeout(() => {
                        window.location.href = result.redirect;
                    }, 500); 
                } else if (redirectUrl) {
                    console.log(`handleFormSubmission: Redirecting to ${redirectUrl}`);
                    setTimeout(() => {
                        window.location.href = redirectUrl;
                    }, 500); 
                }
            } else {
                console.error(`handleFormSubmission: Form submission failed. Message: ${result.message}`);
                hideLoadingOverlay(result.message, 'error');
                displayMessage(result.message, 'error', formMessagesElementId);
            }
        } catch (error) {
            console.error('handleFormSubmission: Catch block - Error during form submission (network or unhandled):', error);
            hideLoadingOverlay('A network error occurred.', 'error');
            displayMessage('A network error occurred. Please check your internet connection and server status.', 'error', formMessagesElementId);
        }
    }

    // --- Form Specific Handlers ---

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            handleFormSubmission(event, '/api/login'); // Redirect handled by server response
        });
    }

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (event) => {
            handleFormSubmission(event, '/api/admin_login'); // Redirect handled by server response
        });
    }

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (event) => {
            handleFormSubmission(event, '/api/contact_us');
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;

            if (password !== confirmPassword) {
                displayMessage('Passwords do not match.', 'error', 'formMessages');
                // No need to hide loading overlay here as it's not shown yet by handleFormSubmission
                return;
            }
            handleFormSubmission(event, '/api/register', 'login.html');
        });
    }

    const forgotPasswordForm = document.getElementById('passwordResetForm'); 
    if (forgotPasswordForm) {
        forgotPasswordForm.dataset.messageTargetId = 'resetMessages'; 
        forgotPasswordForm.addEventListener('submit', (event) => {
            handleFormSubmission(event, '/api/forgot_password', null, 'resetMessages');
        });
    }

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        const resetTokenField = document.getElementById('resetToken');
        if (resetTokenField && token) {
            resetTokenField.value = token;
        } else if (!token) {
            displayMessage('Invalid or missing password reset token. Please try again from the forgot password link.', 'error', 'formMessages');
            resetPasswordForm.style.display = 'none';
            // No need to hide loading overlay here as it's not shown yet by handleFormSubmission
            return;
        }

        resetPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                displayMessage('New passwords do not match.', 'error', 'formMessages');
                // No need to hide loading overlay here as it's not shown yet by handleFormSubmission
                return;
            }
            await handleFormSubmission(event, '/api/reset_password', 'login.html');
        });
    }

    // --- Logout Function (Now triggered from dropdown item) ---
    async function performLogout() {
        showLoadingOverlay('Logging out...', 'spinner');
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                hideLoadingOverlay(data.message, 'success');
                displayMessage(data.message, 'success', 'formMessages');
                const cartItemCountSpan = document.getElementById('cartItemCount');
                if (cartItemCountSpan) cartItemCountSpan.textContent = '0';

                // After logout, update isLoggedIn status
                isLoggedIn = false; 
                // Re-render products to reflect non-logged-in state (e.g., show Add to Cart buttons)
                if (document.querySelector('.product-listing-section')) {
                    renderProducts(); // Re-render with current login state
                }

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            } else {
                hideLoadingOverlay(data.message || 'Logout failed.', 'error');
                displayMessage('Logout failed: ' + (data.message || 'Unknown error'), 'error', 'formMessages');
            }
        } catch (error) {
            console.error('Error during logout:', error);
            hideLoadingOverlay('Network error during logout.', 'error');
            displayMessage('Network error during logout. Please try again.', 'error', 'formMessages');
        }
    }

    // Attach logout handler to the dropdown logout link
    const logoutLinkDropdown = document.getElementById('logout-link-dropdown');
    if (logoutLinkDropdown) {
        logoutLinkDropdown.addEventListener('click', function(e) {
            e.preventDefault();
            performLogout();
        });
    }

    // --- Profile Dropdown Toggle Logic ---
    const profileDropdownBtn = document.getElementById('profileDropdownBtn');
    if (profileDropdownBtn) {
        const profileDropdownContent = document.getElementById('profileDropdownContent');

        profileDropdownBtn.addEventListener('click', function() {
            profileDropdownContent.classList.toggle('show');
        });

        window.addEventListener('click', function(event) {
            if (!event.target.matches('#profileDropdownBtn') && !profileDropdownBtn.contains(event.target)) {
                if (profileDropdownContent.classList.contains('show')) {
                    profileDropdownContent.classList.remove('show');
                }
            }
        });
    }

    // NEW: Login Dropdown Toggle Logic (for the main header login button)
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const loginDropdownContent = document.getElementById('loginDropdownContent');

    if (headerLoginBtn && loginDropdownContent) {
        headerLoginBtn.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default link behavior
            loginDropdownContent.classList.toggle('show');
        });

        // Close the dropdown if the user clicks outside of it
        window.addEventListener('click', function(event) {
            if (!event.target.matches('#headerLoginBtn') && !headerLoginBtn.contains(event.target) &&
                !event.target.matches('#loginDropdownContent') && !loginDropdownContent.contains(event.target)) {
                if (loginDropdownContent.classList.contains('show')) {
                    loginDropdownContent.classList.remove('show');
                }
            }
        });
    }


    // --- Cart & Product Functionality ---

    const cartItemCountSpan = document.getElementById('cartItemCount');

    // Function to fetch and update cart count from backend
    async function updateCartCount() {
        if (!cartItemCountSpan) return;

        // Only try to fetch cart count if logged in
        if (!isLoggedIn) {
            cartItemCountSpan.textContent = '0';
            return;
        }

        try {
            const response = await fetch('/api/get_cart_count');
            const data = await response.json();
            if (data.success) {
                cartItemCountSpan.textContent = data.count;
            } else {
                console.error('Failed to get cart count:', data.message);
                cartItemCountSpan.textContent = '0';
            }
        } catch (error) {
            console.error('Network error fetching cart count:', error);
            cartItemCountSpan.textContent = '0';
        }
    }

    // Function to render the state of a product card (Add to Cart vs. Quantity Controls)
    function renderProductCardState(productId, quantity = 0) {
        const productCard = document.querySelector(`.product-card[data-product-id="${productId}"]`);
        if (!productCard) {
            console.warn(`renderProductCardState: Product card with ID ${productId} not found.`);
            return;
        }

        const addToCartBtn = productCard.querySelector('.btn-add-to-cart'); 
        const quantityControls = productCard.querySelector('.quantity-controls-product-card');
        const quantityDisplay = productCard.querySelector('.product-quantity-display');

        // Always show "Add to Cart" if not logged in
        if (!isLoggedIn) {
            if (addToCartBtn) addToCartBtn.style.display = 'block';
            if (quantityControls) quantityControls.style.display = 'none';
            return;
        }

        // If logged in, show controls based on quantity
        if (quantity > 0) {
            if (addToCartBtn) addToCartBtn.style.display = 'none';
            if (quantityControls) quantityControls.style.display = 'flex'; // Use flex to show controls
            if (quantityDisplay) quantityDisplay.textContent = quantity;
            console.log(`renderProductCardState: Product ${productId} set to quantity ${quantity}. Showing controls.`);
        } else {
            if (addToCartBtn) addToCartBtn.style.display = 'block';
            if (quantityControls) quantityControls.style.display = 'none';
            console.log(`renderProductCardState: Product ${productId} set to quantity 0. Showing Add to Cart button.`);
        }
    }

    // Load initial product states on products page load
    async function loadProductStates() {
        // Only run this if we are on the products page (check for a unique element)
        if (!document.querySelector('.product-listing-section')) {
            console.log("loadProductStates: Not on products page, skipping.");
            return;
        }

        console.log("loadProductStates: Products page detected. Initiating loadProductStates...");

        // Only attempt to load cart items if the user is logged in
        if (!isLoggedIn) {
            document.querySelectorAll('.product-card').forEach(card => {
                renderProductCardState(card.dataset.productId, 0); // Ensure all show "Add to Cart"
            });
            return;
        }

        try {
            const response = await fetch('/api/get_cart_items');
            const data = await response.json();

            if (data.success && data.items) {
                const cartItemsMap = {};
                data.items.forEach(item => {
                    cartItemsMap[item.product_id.toString()] = item.quantity;
                });

                document.querySelectorAll('.product-card').forEach(card => {
                    const productIdHtml = card.dataset.productId;
                    const quantityInCart = cartItemsMap[productIdHtml] || 0;
                    renderProductCardState(productIdHtml, quantityInCart);
                });
            } else {
                console.warn("loadProductStates: Failed to load cart items for product states or cart is empty:", data.message);
                document.querySelectorAll('.product-card').forEach(card => {
                    renderProductCardState(card.dataset.productId, 0);
                });
            }
        } catch (error) {
            console.error("loadProductStates: Network error loading product states or JSON parsing failed:", error);
            document.querySelectorAll('.product-card').forEach(card => {
                renderProductCardState(card.dataset.productId, 0);
            });
        }
    }


    // Handle Add to Cart Clicks (on products.html)
    async function handleAddToCart(event) {
        if (!isLoggedIn) {
            showLoginRequiredModal('Please log in to add items to your cart.');
            return;
        }

        const productId = event.target.dataset.productId;
        const productName = event.target.dataset.productName;
        const productStock = parseInt(event.target.dataset.productStock);

        if (productStock <= 0) {
            displayMessage('This product is out of stock!', 'error', 'productMessages');
            return;
        }

        const originalText = event.target.textContent;
        event.target.disabled = true;
        event.target.textContent = 'Adding...';

        showLoadingOverlay(`Adding ${productName} to cart...`, 'spinner');

        try {
            const formData = new FormData();
            formData.append('product_id', productId);
            formData.append('quantity', 1); // Add one at a time

            const response = await fetch('/api/add_to_cart', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                hideLoadingOverlay(data.message, 'success');
                displayMessage(data.message, 'success', 'productMessages');
                updateCartCount();
                renderProductCardState(productId, data.new_quantity || 1); // Use new_quantity from backend or default to 1
            } else {
                hideLoadingOverlay(data.message || 'Could not add product to cart.', 'error');
                displayMessage('Error: ' + (data.message || 'Could not add product to cart.'), 'error', 'productMessages');
            }
        } catch (error) {
            hideLoadingOverlay('Network error while adding to cart.', 'error');
            displayMessage('Network error while adding to cart. Please check your connection.', 'error', 'productMessages');
            console.error('Error adding to cart:', error);
        } finally {
            event.target.textContent = originalText;
            event.target.disabled = false;
        }
    }

    // Function to render cart items on the cart page
    async function renderCartPage() {
        const cartItemsContainer = document.getElementById('cartItemsContainer');
        const emptyMessage = document.getElementById('emptyCartMessage');
        const cartSubtotalElement = document.getElementById('cartSubtotal');
        const cartShippingElement = document.getElementById('cartShipping');
        const cartTotalElement = document.getElementById('cartTotal');
        const cartPageMessage = document.getElementById('cartPageMessages');

        if (!cartItemsContainer || !emptyMessage || !cartSubtotalElement || !cartShippingElement || !cartTotalElement) {
            console.warn("renderCartPage: Cart page elements not found. Cannot render cart.");
            return;
        }

        // Only attempt to load cart if logged in
        if (!isLoggedIn) {
            displayMessage('Please log in to view your cart.', 'info', 'cartPageMessages');
            emptyMessage.style.display = 'block';
            document.querySelector('.cart-summary-card').style.display = 'none';
            document.querySelector('.cart-action-buttons').style.display = 'none';
            return;
        }

        displayMessage('Loading cart...', 'info', 'cartPageMessages');
        cartItemsContainer.innerHTML = ''; // Clear existing items

        try {
            const response = await fetch('/api/get_cart_items');
            const data = await response.json();

            if (!data.success) {
                displayMessage(data.message || 'Failed to load cart items.', 'error', 'cartPageMessages');
                emptyMessage.style.display = 'block';
                document.querySelector('.cart-summary-card').style.display = 'none';
                document.querySelector('.cart-action-buttons').style.display = 'none';
                return;
            }

            const cartItems = data.items;
            let subtotal = 0;

            if (cartItems.length === 0) {
                displayMessage('Your cart is empty!', 'info', 'cartPageMessages');
                emptyMessage.style.display = 'block';
                document.querySelector('.cart-summary-card').style.display = 'none';
                document.querySelector('.cart-action-buttons').style.display = 'none';
            } else {
                displayMessage('', '', 'cartPageMessages');
                emptyMessage.style.display = 'none';
                document.querySelector('.cart-summary-card').style.display = 'block';
                document.querySelector('.cart-action-buttons').style.display = 'flex';

                cartItems.forEach(item => {
                    const itemTotal = parseFloat(item.price) * parseInt(item.quantity);
                    subtotal += itemTotal;

                    const cartItemDiv = document.createElement('div');
                    cartItemDiv.className = 'cart-item';
                    cartItemDiv.innerHTML = `
                        <img src="${item.image_url || 'https://placehold.co/100x100/E0F2F1/000000?text=Product'}" alt="${item.name || 'Product Image'}" class="cart-item-image">
                        <div class="cart-item-details">
                            <h4 class="cart-item-name">${item.name || 'Unknown Product'}</h4>
                            <p class="cart-item-price">Price: ₹${parseFloat(item.price).toFixed(2)}</p>
                        </div>
                        <div class="cart-item-quantity-controls">
                            <button class="quantity-btn decrease-quantity-btn" data-product-id="${item.product_id}">-</button>
                            <span class="item-quantity">${item.quantity}</span>
                            <button class="quantity-btn increase-quantity-btn" data-product-id="${item.product_id}">+</button>
                        </div>
                        <div class="cart-item-total">₹${itemTotal.toFixed(2)}</div>
                        <button class="remove-item-btn" data-product-id="${item.product_id}"><i class="bi bi-trash-fill"></i></button>
                    `;
                    cartItemsContainer.appendChild(cartItemDiv);
                });
            }

            cartSubtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
            cartShippingElement.textContent = `Free`;
            cartTotalElement.textContent = `₹${subtotal.toFixed(2)}`;

            addCartEventListeners();
        } catch (error) {
            console.error('renderCartPage: Error rendering cart page:', error);
            displayMessage('Error loading cart. Please try again.', 'error', 'cartPageMessages');
            emptyMessage.style.display = 'block';
            document.querySelector('.cart-summary-card').style.display = 'none';
            document.querySelector('.cart-action-buttons').style.display = 'none';
        }
    }

    // Function to add event listeners to cart quantity and remove buttons (called after rendering)
    function addCartEventListeners() {
        document.querySelectorAll('.increase-quantity-btn').forEach(button => {
            button.removeEventListener('click', handleCartItemQuantityChange);
            button.addEventListener('click', handleCartItemQuantityChange);
        });
        document.querySelectorAll('.decrease-quantity-btn').forEach(button => {
            button.removeEventListener('click', handleCartItemQuantityChange);
            button.addEventListener('click', handleCartItemQuantityChange);
        });
        document.querySelectorAll('.remove-item-btn').forEach(button => {
            button.removeEventListener('click', handleRemoveItemClick);
            button.addEventListener('click', handleRemoveItemClick);
        });
    }

    async function handleCartItemQuantityChange(event) {
        if (!isLoggedIn) {
            showLoginRequiredModal('Please log in to update cart quantity.');
            return;
        }

        const productId = event.target.dataset.productId;
        const changeType = event.target.classList.contains('increase-quantity-btn') ? 'increase' : 'decrease';
        await updateCartItemQuantity(productId, changeType);
    }

    async function handleRemoveItemClick(event) {
        if (!isLoggedIn) {
            showLoginRequiredModal('Please log in to remove items from cart.');
            return;
        }
        const productId = event.currentTarget.dataset.productId;
        await removeItemFromCart(productId);
    }

    async function updateCartItemQuantity(productId, changeType) {
        const cartMessages = document.getElementById('cartPageMessages') || document.getElementById('formMessages');
        displayMessage('Updating cart...', 'info', cartMessages.id);

        const formData = new FormData();
        formData.append('product_id', productId);
        formData.append('change_type', changeType);

        try {
            const response = await fetch('/api/update_cart_quantity', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                displayMessage(data.message, 'success', cartMessages.id);
                renderCartPage();
                updateCartCount();
                // loadProductStates(); // No need to call this from cart page, only on products page
            } else {
                displayMessage(`Failed to update quantity: ${data.message || 'Unknown error'}`, 'error', cartMessages.id);
            }
        } catch (error) {
            console.error('updateCartItemQuantity: Network error updating cart quantity:', error);
            displayMessage('Network error updating cart quantity.', 'error', cartMessages.id);
        }
    }

    async function removeItemFromCart(productId) {
        const cartMessages = document.getElementById('cartPageMessages') || document.getElementById('formMessages');
        displayMessage('Removing item...', 'info', cartMessages.id);

        const formData = new FormData();
        formData.append('product_id', productId);

        try {
            const response = await fetch('/api/remove_from_cart', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                displayMessage(data.message, 'success', cartMessages.id);
                renderCartPage();
                updateCartCount();
                // loadProductStates(); // No need to call this from cart page, only on products page
            } else {
                displayMessage(`Failed to remove item: ${data.message || 'Unknown error'}`, 'error', cartMessages.id);
            }
        } catch (error) {
            console.error('removeItemFromCart: Network error removing item:', error);
            displayMessage('Network error removing item.', 'error', cartMessages.id);
        }
    }

    // Handle quantity changes directly on product cards (products.html)
    async function handleProductCardQuantityChange(event) {
        if (!isLoggedIn) {
            showLoginRequiredModal('Please log in to update cart quantity.');
            return;
        }

        const button = event.target;
        const productId = button.dataset.productId;
        const changeType = button.classList.contains('increase-quantity-product-card') ? 'increase' : 'decrease';

        const productCard = button.closest('.product-card');
        const quantityDisplay = productCard.querySelector('.product-quantity-display');
        let currentQuantity = parseInt(quantityDisplay.textContent);

        // Optimistic UI update
        if (changeType === 'increase') {
            currentQuantity++;
        } else if (changeType === 'decrease' && currentQuantity > 0) {
            currentQuantity--;
        }
        quantityDisplay.textContent = currentQuantity;

        const formData = new FormData();
        formData.append('product_id', productId);
        formData.append('change_type', changeType);

        showLoadingOverlay('Updating cart...', 'spinner'); // Show loading overlay for this action

        try {
            const response = await fetch('/api/update_cart_quantity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `product_id=${productId}&change_type=${changeType}`
            });
            const data = await response.json();

            if (data.success) {
                hideLoadingOverlay(data.message, 'success'); // Hide with success message
                displayMessage(data.message, 'success', 'productMessages');
                updateCartCount();
                renderProductCardState(productId, data.new_quantity); // Update state based on new_quantity from backend
            } else {
                // Revert optimistic UI update on failure
                quantityDisplay.textContent = currentQuantity + (changeType === 'increase' ? -1 : 1);
                hideLoadingOverlay(data.message || 'Failed to update quantity.', 'error'); // Hide with error message
                displayMessage(`Failed to update quantity: ${data.message || 'Unknown error'}`, 'error', 'productMessages');
            }
        } catch (error) {
            // Revert optimistic UI update on network error
            quantityDisplay.textContent = currentQuantity + (changeType === 'increase' ? -1 : 1);
            hideLoadingOverlay('Network error updating quantity.', 'error'); // Hide with network error message
            displayMessage('Network error updating quantity.', 'error', 'productMessages');
            console.error('handleProductCardQuantityChange: Error updating quantity:', error);
        }
    }

    // --- Order Summary Logic (Used on both Checkout and Payment pages) ---
    async function renderOrderSummary(targetMessagesId = 'checkoutMessages') {
        const orderSummaryItemsContainer = document.getElementById('orderSummaryItems');
        const orderSubtotalElement = document.getElementById('orderSubtotal');
        const orderShippingElement = document.getElementById('orderShipping');
        const orderTotalElement = document.getElementById('orderTotal');
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        const shippingFormContainer = document.getElementById('shippingFormContainer'); 

        if (!orderSummaryItemsContainer || !orderSubtotalElement || !orderShippingElement || !orderTotalElement) {
            console.warn("renderOrderSummary: Required order summary elements not found.");
            return;
        }

        orderSummaryItemsContainer.innerHTML = '';
        let subtotal = 0;

        // Only attempt to load cart if logged in
        if (!isLoggedIn) {
            displayMessage('Please log in to view your order summary.', 'info', targetMessagesId);
            orderSummaryItemsContainer.innerHTML = '<p>Please log in to view your order summary.</p>';
            if (placeOrderBtn) placeOrderBtn.style.display = 'none';
            if (shippingFormContainer) {
                shippingFormContainer.style.display = 'none';
            }
            orderSubtotalElement.textContent = `₹0.00`;
            orderShippingElement.textContent = `Free`;
            orderTotalElement.textContent = `₹0.00`;
            return;
        }

        showLoadingOverlay('Loading order summary...', 'spinner'); // Show loading overlay

        try {
            const response = await fetch('/api/get_cart_items');
            const data = await response.json();

            if (!data.success) {
                console.error('renderOrderSummary: Failed to load cart items:', data.message);
                orderSummaryItemsContainer.innerHTML = '<p>Your cart is empty. Please add items before checking out.</p>';
                if (placeOrderBtn) placeOrderBtn.style.display = 'none';
                if (shippingFormContainer) {
                    shippingFormContainer.style.display = 'none'; 
                }
                orderSubtotalElement.textContent = `₹0.00`;
                orderShippingElement.textContent = `Free`;
                orderTotalElement.textContent = `₹0.00`;
                hideLoadingOverlay('Failed to load cart items.', 'error'); // Hide with error message
                return;
            }

            const cartItems = data.items;
            
            if (cartItems.length === 0) {
                displayMessage('Your cart is empty! Please add items to proceed.', 'info', targetMessagesId);
                orderSummaryItemsContainer.innerHTML = '<p>Your cart is empty. Please add items before checking out.</p>';
                if (placeOrderBtn) placeOrderBtn.style.display = 'none';
                if (shippingFormContainer) {
                    shippingFormContainer.style.display = 'none';
                }
                hideLoadingOverlay('Cart is empty.', 'info'); // Hide with info message
            } else {
                displayMessage('', '', targetMessagesId);
                if (shippingFormContainer) {
                    shippingFormContainer.style.display = 'block'; 
                }

                cartItems.forEach(item => {
                    const itemTotal = parseFloat(item.price) * parseInt(item.quantity);
                    subtotal += itemTotal;

                    const orderItemDiv = document.createElement('div');
                    orderItemDiv.className = 'order-item';
                    orderItemDiv.innerHTML = `
                        <img src="${item.image_url || 'https://placehold.co/50x50/E0F2F1/000000?text=Product'}" alt="${item.name || 'Product Image'}" class="order-item-image">
                            <div>
                                <div class="order-item-name">${item.name || 'Unknown Product'}</div>
                                <div class="order-item-quantity-price">${item.quantity} x ₹${parseFloat(item.price).toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="order-item-total-price">₹${itemTotal.toFixed(2)}</div>
                    `;
                    orderSummaryItemsContainer.appendChild(orderItemDiv);
                });
                hideLoadingOverlay('Order summary loaded.', 'success'); // Hide with success message
            }

            cartSubtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
            cartShippingElement.textContent = `Free`;
            cartTotalElement.textContent = `₹${subtotal.toFixed(2)}`;

            const codAmountSpan = document.getElementById('codAmount');
            if (codAmountSpan) {
                codAmountSpan.textContent = subtotal.toFixed(2);
            }

            const upiAmountSpan = document.getElementById('upiAmount');
            if (upiAmountSpan) {
                upiAmountSpan.textContent = subtotal.toFixed(2);
            }

        } catch (error) {
            console.error('renderOrderSummary: Network error rendering order summary:', error);
            orderSummaryItemsContainer.innerHTML = '<p>Could not load order summary. Please check your connection.</p>';
            if (placeOrderBtn) placeOrderBtn.style.display = 'none';
            if (shippingFormContainer) {
                shippingFormContainer.style.display = 'none';
            }
            hideLoadingOverlay('Network error loading summary.', 'error'); // Hide with network error message
        }
    }

    // Function to load saved shipping information and pre-fill the form
    async function loadShippingInfo() {
        const shippingForm = document.getElementById('shippingForm');
        if (!shippingForm) {
            return;
        }
        const checkoutMessages = document.getElementById('checkoutMessages');

        // Only attempt to load shipping info if logged in
        if (!isLoggedIn) {
            displayMessage('Please log in to manage shipping information.', 'info', 'checkoutMessages');
            shippingForm.style.display = 'none'; // Hide form if not logged in
            return;
        }

        showLoadingOverlay('Loading shipping information...', 'spinner'); // Show loading overlay

        try {
            const response = await fetch('/api/get_shipping_info');
            const data = await response.json();

            if (data.success && data.shipping_info) {
                const info = data.shipping_info;
                document.getElementById('fullName').value = info.full_name || '';
                document.getElementById('addressLine1').value = info.address_line1 || '';
                document.getElementById('addressLine2').value = info.address_line2 || '';
                const addressLine3Input = document.getElementById('addressLine3');
                if (addressLine3Input) {
                    addressLine3Input.value = info.address_line3 || '';
                }
                document.getElementById('city').value = info.city || '';
                document.getElementById('state').value = info.state || '';
                document.getElementById('zipCode').value = info.zip_code || '';
                document.getElementById('phone').value = info.phone || '';

                hideLoadingOverlay('Saved shipping information loaded.', 'success'); // Hide with success message
                displayMessage('Saved shipping information loaded.', 'info', 'checkoutMessages');
            } else {
                console.log('loadShippingInfo: No saved shipping information found or failed to load:', data.message);
                hideLoadingOverlay('No saved shipping information.', 'info'); // Hide with info message
            }
        } catch (error) {
            console.error('loadShippingInfo: Network error loading shipping info:', error);
            hideLoadingOverlay('Network error loading shipping info.', 'error'); // Hide with network error message
        }
    }


    // --- Checkout Page Specific Logic (Now only for Shipping) ---
    const shippingForm = document.getElementById('shippingForm');
    if (shippingForm) {
        shippingForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            if (!isLoggedIn) {
                displayMessage('Please log in to save shipping information.', 'info', 'checkoutMessages');
                return;
            }

            const requiredInputs = shippingForm.querySelectorAll('input[required]');
            let allFieldsFilled = true;
            for (const input of requiredInputs) {
                if (!input.value.trim()) {
                    allFieldsFilled = false;
                    break;
                }
            }

            if (!allFieldsFilled) {
                displayMessage('Please fill in all required shipping fields.', 'error', 'checkoutMessages');
                return;
            }

            const zipCodeInput = document.getElementById('zipCode');
            const phoneInput = document.getElementById('phone');

            const zipCodePattern = /^\d{5,6}$/;
            const phonePattern = /^\d{10}$/;

            if (zipCodeInput && !zipCodePattern.test(zipCodeInput.value)) {
                displayMessage('Invalid Zip Code format. Must be 5 or 6 digits.', 'error', 'checkoutMessages');
                return;
            }
            if (phoneInput && !phonePattern.test(phoneInput.value)) {
                displayMessage('Invalid Phone Number format. Must be 10 digits.', 'error', 'checkoutMessages');
                return;
            }

            showLoadingOverlay('Saving shipping information...', 'spinner'); // Show loading overlay
            displayMessage('Saving shipping information...', 'info', 'checkoutMessages');
            const submitBtn = shippingForm.querySelector('.next-step-btn');
            submitBtn.disabled = true;

            const formData = new FormData(shippingForm);
            const addressLine3Input = document.getElementById('addressLine3');
            if (addressLine3Input) {
                formData.append('addressLine3', addressLine3Input.value);
            }

            try {
                const response = await fetch('/api/save_shipping_info', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    hideLoadingOverlay(data.message, 'success'); // Hide with success message
                    displayMessage(data.message, 'success', 'checkoutMessages');
                    if (data.redirect) {
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1000);
                    }
                } else {
                    hideLoadingOverlay(data.message || 'Failed to save shipping information.', 'error'); // Hide with error message
                    displayMessage(data.message || 'Failed to save shipping information.', 'error', 'checkoutMessages');
                }
            } catch (error) {
                console.error('Error saving shipping info (network/unhandled):', error);
                hideLoadingOverlay('Network error saving shipping information.', 'error'); // Hide with network error message
                displayMessage('Network error saving shipping information. Please try again.', 'error', 'checkoutMessages');
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // --- Payment Page Specific Logic ---
    const cardPaymentForm = document.getElementById('cardPaymentForm');
    const upiPaymentForm = document.getElementById('upiPaymentSection');
    const codPaymentForm = document.getElementById('codPaymentSection');
    const paymentMessages = document.getElementById('paymentMessages');

    const otpVerificationSection = document.getElementById('otpVerificationSection');
    const otpInput = document.getElementById('otpInput');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendOtpLink = document.getElementById('resendOtpLink');
    const otpMessage = document.getElementById('otpMessage');


    function showPaymentMethod(methodId) {
        document.querySelectorAll('.payment-method-content').forEach(section => {
            section.style.display = 'none';
        });
        const selectedSection = document.getElementById(methodId);
        if (selectedSection) {
            selectedSection.style.display = 'block';
        }
        
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        if (placeOrderBtn) {
            if (methodId === 'codPaymentSection') {
                placeOrderBtn.style.display = 'block';
                displayMessage('Cash on Delivery selected. Review your order and place it.', 'info', 'paymentMessages');
            } else {
                placeOrderBtn.style.display = 'none';
                displayMessage('', '', 'paymentMessages');
            }
        }

        if (otpVerificationSection) {
            otpVerificationSection.style.display = 'none';
            otpInput.value = '';
            displayMessage('', '', 'otpMessage');
        }
        if (cardPaymentForm) {
            cardPaymentForm.querySelectorAll('input').forEach(input => input.readOnly = false);
            cardPaymentForm.querySelector('.next-step-btn').disabled = false;
        }
    }

    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            showPaymentMethod(event.target.value + 'PaymentSection');
        });
    });

    if (cardPaymentForm) {
        cardPaymentForm.addEventListener('submit', (event) => {
            event.preventDefault();

            if (!isLoggedIn) {
                showLoginRequiredModal('Please log in to proceed with payment.');
                return;
            }

            const cardNameInput = document.getElementById('cardName');
            const cardNumberInput = document.getElementById('cardNumber');
            const expiryDateInput = document.getElementById('expiryDate');
            const cvvInput = document.getElementById('cvv');

            if (cardNameInput && !cardNameInput.checkValidity()) {
                displayMessage(cardNameInput.title || 'Please enter the name on the card.', 'error', 'paymentMessages');
                return;
            }

            const cardNumberPattern = /^\d{13,16}$/;
            const expiryDatePattern = /^(0[1-9]|1[0-2])\/\d{2}$/;
            const cvvPattern = /^\d{3,4}$/;

            if (cardNumberInput && !cardNumberPattern.test(cardNumberInput.value)) {
                displayMessage('Invalid Card Number. Must be 13-16 digits.', 'error', 'paymentMessages');
                return;
            }
            if (expiryDateInput && !expiryDatePattern.test(expiryDateInput.value)) {
                displayMessage('Invalid Expiry Date format (MM/YY).', 'error', 'paymentMessages');
                return;
            }
            if (cvvInput && !cvvPattern.test(cvvInput.value)) {
                displayMessage('Invalid CVV. Must be 3 or 4 digits.', 'error', 'paymentMessages');
                return;
            }
            
            const [month, year] = expiryDateInput.value.split('/').map(Number);
            const currentYear = new Date().getFullYear() % 100;
            const currentMonth = new Date().getMonth() + 1;
            
            if (year < currentYear || (year === currentYear && month < currentMonth)) {
                displayMessage('Expiry date cannot be in the past.', 'error', 'paymentMessages');
                return;
            }

            showLoadingOverlay('Card details confirmed. Sending OTP...', 'spinner'); // Show loading overlay
            displayMessage('Card details confirmed. Sending OTP...', 'info', 'paymentMessages');
            cardPaymentForm.querySelector('.next-step-btn').disabled = true;
            cardPaymentForm.querySelectorAll('input').forEach(input => input.readOnly = true);

            simulatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log('Simulated OTP:', simulatedOtp);

            if (otpVerificationSection) {
                otpVerificationSection.style.display = 'block';
                hideLoadingOverlay('OTP sent!', 'success'); // Hide with success message
                displayMessage('An OTP has been sent to your registered mobile number. Please enter it below.', 'info', 'otpMessage');
                otpInput.focus();
            }
        });
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            if (!isLoggedIn) {
                showLoginRequiredModal('Please log in to verify OTP and place order.');
                return;
            }
            const enteredOtp = otpInput.value.trim();

            if (enteredOtp === simulatedOtp) {
                showLoadingOverlay('OTP verified successfully. Placing your order...', 'spinner'); // Show loading overlay
                displayMessage('OTP verified successfully. Placing your order...', 'success', 'otpMessage');
                verifyOtpBtn.disabled = true;
                resendOtpLink.style.display = 'none';

                const selectedPaymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
                let paymentMethod = selectedPaymentMethodRadio ? selectedPaymentMethodRadio.value : 'card';

                const formData = new FormData();
                formData.append('payment_method', paymentMethod);

                try {
                    const response = await fetch('/api/place_order', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    if (data.success) {
                        hideLoadingOverlay('Order placed successfully!', 'success'); // Hide with success message
                        displayMessage(data.message || 'Your order has been placed successfully!', 'success', 'paymentMessages');
                        updateCartCount();
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1500);
                    } else {
                        hideLoadingOverlay('Order failed!', 'error'); // Hide with error message
                        displayMessage(data.message || 'Failed to place order after OTP verification.', 'error', 'paymentMessages');
                        verifyOtpBtn.disabled = false;
                        resendOtpLink.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Error placing order after OTP verification:', error);
                    hideLoadingOverlay('Network error!', 'error'); // Hide with network error message
                    displayMessage('Network error placing order. Please try again.', 'error', 'paymentMessages');
                    verifyOtpBtn.disabled = false;
                    resendOtpLink.style.display = 'block';
                }
            } else {
                displayMessage('Invalid OTP. Please try again.', 'error', 'otpMessage');
                otpInput.value = '';
                otpInput.focus();
            }
        });
    }

    if (resendOtpLink) {
        resendOtpLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (!isLoggedIn) {
                showLoginRequiredModal('Please log in to resend OTP.');
                return;
            }
            simulatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log('New Simulated OTP:', simulatedOtp);
            displayMessage('New OTP has been sent. Please check your mobile.', 'info', 'otpMessage');
            otpInput.value = '';
            otpInput.focus();
            if (verifyOtpBtn) verifyOtpBtn.disabled = false;
        });
    }

    if (upiPaymentForm) {
        // No direct submit button on the UPI section itself, it's a display.
    }

    if (codPaymentForm) {
        // No direct submit button on the COD section itself, it's a display.
    }

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) { 
        placeOrderBtn.addEventListener('click', async () => {
            if (!isLoggedIn) {
                showLoginRequiredModal('Please log in to place your order.');
                return;
            }

            const selectedPaymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
            let paymentMethod = selectedPaymentMethodRadio ? selectedPaymentMethodRadio.value : null;

            if (!paymentMethod || paymentMethod === 'card') {
                displayMessage('Please confirm card details and verify OTP to place order.', 'error', 'paymentMessages');
                return;
            }

            showLoadingOverlay('Placing your order...', 'spinner');
            displayMessage('Placing your order...', 'info', 'paymentMessages');
            placeOrderBtn.disabled = true;

            const formData = new FormData();
            formData.append('payment_method', paymentMethod);

            try {
                const response = await fetch('/api/place_order', { 
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    hideLoadingOverlay('Order placed successfully!', 'success');
                    displayMessage(data.message || 'Your order has been placed successfully!', 'success', 'paymentMessages');
                    updateCartCount();
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 1500);
                } else {
                    hideLoadingOverlay('Order failed!', 'error');
                    displayMessage(data.message || 'Failed to place order.', 'error', 'paymentMessages');
                }
            } catch (error) {
                console.error('Error placing order (network/unhandled):', error);
                hideLoadingOverlay('Network error!', 'error');
                displayMessage('Network error placing order. Please try again.', 'error', 'paymentMessages');
            } finally {
                if (placeOrderBtn) placeOrderBtn.disabled = false;
            }
        });
    }

    async function renderOrderConfirmationPage() {
        const confirmationContainer = document.querySelector('.order-confirmation-section');
        if (!confirmationContainer) {
            return;
        }
        showLoadingOverlay('Loading order details...', 'spinner');

        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order_id');
        const confirmationMessages = document.getElementById('confirmationMessages');
        
        if (!orderId) {
            displayMessage('Order ID missing from URL. Cannot display order details.', 'error', 'confirmationMessages');
            const orderDetailsSummary = document.querySelector('.order-details-summary');
            if (orderDetailsSummary) orderDetailsSummary.style.display = 'none';
            hideLoadingOverlay('Error loading order details.', 'error');
            return;
        }

        // Only load order details if logged in (as it's user-specific data)
        if (!isLoggedIn) {
            displayMessage('Please log in to view order details.', 'info', 'confirmationMessages');
            const orderDetailsSummary = document.querySelector('.order-details-summary');
            if (orderDetailsSummary) orderDetailsSummary.style.display = 'none';
            hideLoadingOverlay('Not logged in.', 'info');
            return;
        }


        try {
            const response = await fetch(`/api/get_order_details/${orderId}`);
            const data = await response.json();

            if (data.success && data.order) {
                const order = data.order;
                document.getElementById('orderIdDisplay').textContent = `#${order.id}`;
                document.getElementById('orderDateDisplay').textContent = new Date(order.order_date).toLocaleString();
                document.getElementById('orderTotalDisplay').textContent = `₹${parseFloat(order.total_amount).toFixed(2)}`;
                document.getElementById('paymentMethodDisplay').textContent = order.payment_method ? order.payment_method.toUpperCase() : 'N/A';
                
                const orderStatusDisplay = document.getElementById('orderStatusDisplay');
                orderStatusDisplay.textContent = order.status;
                orderStatusDisplay.className = `order-status-badge ${order.status.toLowerCase()}`;


                const shippingAddressDisplay = document.getElementById('shippingAddressDisplay');
                shippingAddressDisplay.innerHTML = `
                    <p>${order.full_name}</p>
                    <p>${order.address_line1}</p>
                    <p>${order.address_line2}</p>
                    ${order.address_line3 ? `<p>${order.address_line3}</p>` : ''}
                    <p>${order.city}, ${order.state} - ${order.zip_code}</p>
                    <p>Phone: ${order.phone}</p>
                `;

                const orderItemsDisplay = document.getElementById('orderItemsDisplay');
                orderItemsDisplay.innerHTML = '';
                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'order-item';
                        itemDiv.innerHTML = `
                            <img src="${item.image_url || 'https://placehold.co/60x60/E0F2F1/000000?text=Product'}" alt="${item.product_name || 'Product Image'}" class="order-item-image">
                            <div class="order-item-details">
                                <h4>${item.product_name || 'Unknown Product'}</h4>
                                <p>${item.quantity} x ₹${parseFloat(item.product_price).toFixed(2)}</p>
                            </div>
                            <span class="order-item-price-total">₹${(item.quantity * parseFloat(item.product_price)).toFixed(2)}</span>
                        `;
                        orderItemsDisplay.appendChild(itemDiv);
                    });
                } else {
                    orderItemsDisplay.innerHTML = '<p>No items found for this order.</p>';
                }

                hideLoadingOverlay('Order details loaded successfully!', 'success'); // Hide with success message
                displayMessage('Order details loaded.', 'success', 'confirmationMessages');

            } else {
                hideLoadingOverlay('Failed to load order details.', 'error'); // Hide with error message
                displayMessage(data.message || 'Failed to load order details.', 'error', 'confirmationMessages');
                const orderDetailsSummary = document.querySelector('.order-details-summary');
                if (orderDetailsSummary) orderDetailsSummary.style.display = 'none';
            }
        } catch (error) {
            console.error('renderOrderConfirmationPage: Network error fetching order details:', error);
            hideLoadingOverlay('Network error!', 'error'); // Hide with network error message
            displayMessage('Network error loading order details. Please try again.', 'error', 'confirmationMessages');
            const orderDetailsSummary = document.querySelector('.order-details-summary');
            if (orderDetailsSummary) orderDetailsSummary.style.display = 'none';
        }
    }


    // --- Order History Page Logic ---
    async function renderOrderHistory() {
        const ordersContainer = document.getElementById('ordersContainer');
        const noOrdersMessage = document.getElementById('noOrdersMessage');
        const orderHistoryMessages = document.getElementById('orderHistoryMessages');

        if (!ordersContainer || !noOrdersMessage || !orderHistoryMessages) {
            console.warn("renderOrderHistory: Required elements not found on order history page.");
            return;
        }

        // Only load order history if logged in
        if (!isLoggedIn) {
            displayMessage('Please log in to view your order history.', 'info', 'orderHistoryMessages');
            noOrdersMessage.style.display = 'block';
            ordersContainer.innerHTML = ''; // Clear any loading message
            return;
        }

        ordersContainer.innerHTML = '';
        showLoadingOverlay('Loading order history...', 'spinner'); // Show loading overlay
        displayMessage('Loading order history...', 'info', 'orderHistoryMessages');
        noOrdersMessage.style.display = 'none';

        try {
            const response = await fetch('/api/get_order_history');
            const data = await response.json();

            if (!data.success) {
                hideLoadingOverlay('Failed to load order history.', 'error'); // Hide with error message
                displayMessage(data.message || 'Failed to load order history.', 'error', 'orderHistoryMessages');
                noOrdersMessage.style.display = 'block';
                return;
            }

            const orders = data.orders;
            if (orders.length === 0) {
                hideLoadingOverlay('You have no past orders.', 'info'); // Hide with info message
                displayMessage('You have no past orders.', 'info', 'orderHistoryMessages');
                noOrdersMessage.style.display = 'block';
            } else {
                hideLoadingOverlay('Order history loaded.', 'success'); // Hide with success message
                displayMessage('', '', 'orderHistoryMessages');
                ordersContainer.innerHTML = ''; // Clear loading message
                orders.forEach(order => {
                    const orderDate = new Date(order.order_date).toLocaleString();
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-card';
                    orderCard.innerHTML = `
                        <div class="order-header">
                            <h3>Order #${order.id}</h3>
                            <span class="order-status-badge ${order.status.toLowerCase()}">${order.status}</span>
                        </div>
                        <div class="order-details">
                            <div><strong>Order Date:</strong> ${orderDate}</div>
                            <div><strong>Total:</strong> ₹${parseFloat(order.total_amount).toFixed(2)}</div>
                            <div><strong>Payment Method:</strong> ${order.payment_method ? order.payment_method.toUpperCase() : 'N/A'}</div>
                            <div><strong>Ship To:</strong> ${order.full_name}</div>
                            <div><strong>Address:</strong> ${order.address_line1}, ${order.address_line2}</div>
                            ${order.address_line3 ? `<div><strong>Landmark:</strong> ${order.address_line3}</div>` : ''}
                            <div><strong>City:</strong> ${order.city}, ${order.state} - ${order.zip_code}</div>
                            <div><strong>Phone:</strong> ${order.phone}</div>
                        </div>
                        <div class="order-items-list">
                            <h4>Items:</h4>
                            ${order.items.map(item => `
                                <div class="order-item">
                                    <img src="${item.image_url || 'https://placehold.co/60x60/E0F2F1/000000?text=Product'}" alt="${item.product_name || 'Product Image'}" class="order-item-image">
                                    <div class="order-item-details">
                                        <h4>${item.product_name || 'Unknown Product'}</h4>
                                        <p>${item.quantity} x ₹${parseFloat(item.product_price).toFixed(2)}</p>
                                    </div>
                                    <span class="order-item-price-total">₹${(item.quantity * parseFloat(item.product_price)).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    ordersContainer.appendChild(orderCard);
                });
            }
        } catch (error) {
            console.error('renderOrderHistory: Error fetching order history:', error);
            hideLoadingOverlay('Network error loading history.', 'error'); // Hide with network error message
            displayMessage('Error loading order history. Please try again.', 'error', 'orderHistoryMessages');
            noOrdersMessage.style.display = 'block';
        }
    }

    // --- Settings Page Logic ---
    async function loadUserSettings() {
        const profileInfoForm = document.getElementById('profileInfoForm');
        const shippingAddressForm = document.getElementById('shippingAddressForm');
        const settingsMessages = document.getElementById('settingsMessages');

        if (!profileInfoForm || !shippingAddressForm || !settingsMessages) {
            console.warn("loadUserSettings: Required settings page elements not found.");
            return;
        }

        // Only load user settings if logged in
        if (!isLoggedIn) {
            displayMessage('Please log in to view and manage your profile settings.', 'info', 'settingsMessages');
            profileInfoForm.style.display = 'none';
            shippingAddressForm.style.display = 'none';
            document.getElementById('changePasswordForm').style.display = 'none'; // Assuming this exists
            return;
        }

        showLoadingOverlay('Loading your settings...', 'spinner'); // Show loading overlay
        displayMessage('Loading your settings...', 'info', 'settingsMessages');

        try {
            const response = await fetch('/api/get_user_profile');
            const data = await response.json();

            if (data.success && data.profile) {
                const profile = data.profile;
                document.getElementById('username').value = profile.username || '';
                document.getElementById('email').value = profile.email || '';

                const shipping = profile.shipping_info || {};
                document.getElementById('fullName').value = shipping.full_name || '';
                document.getElementById('addressLine1').value = shipping.address_line1 || '';
                document.getElementById('addressLine2').value = shipping.address_line2 || '';
                const addressLine3Input = document.getElementById('addressLine3');
                if (addressLine3Input) {
                    addressLine3Input.value = shipping.address_line3 || '';
                }
                document.getElementById('city').value = shipping.city || '';
                document.getElementById('state').value = shipping.state || '';
                document.getElementById('zipCode').value = shipping.zip_code || '';
                document.getElementById('phone').value = shipping.phone || '';

                hideLoadingOverlay('Information loaded successfully.', 'success'); // Hide with success message
                displayMessage('Information loaded successfully.', 'success', 'settingsMessages');
            } else {
                hideLoadingOverlay('No user profile data found.', 'info'); // Hide with info message
                displayMessage('', '', 'settingsMessages');
                console.log('loadUserSettings: No user profile data found.');
            }
        } catch (error) {
            console.error('loadUserSettings: Network error fetching user profile:', error);
            hideLoadingOverlay('Network error loading settings.', 'error'); // Hide with network error message
            displayMessage('Network error loading settings. Please try again.', 'error', 'settingsMessages');
        }
    }

    // Attach listeners for settings forms
    const profileInfoForm = document.getElementById('profileInfoForm');
    if (profileInfoForm) {
        profileInfoForm.addEventListener('submit', (event) => {
            handleFormSubmission(event, '/api/update_user_profile', null, 'settingsMessages');
        });
    }

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (event) => {
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                displayMessage('New passwords do not match.', 'error', 'settingsMessages');
                return;
            }
            if (newPassword.length < 6) {
                displayMessage('New password must be at least 6 characters long.', 'error', 'settingsMessages');
                return;
            }
            handleFormSubmission(event, '/api/change_password', null, 'settingsMessages');
        });
    }

    const shippingAddressForm = document.getElementById('shippingAddressForm');
    if (shippingAddressForm) {
        shippingAddressForm.addEventListener('submit', (event) => {
            const zipCodeInput = document.getElementById('zipCode');
            const phoneInput = document.getElementById('phone');
            const addressLine2Input = document.getElementById('addressLine2');

            const zipCodePattern = /^\d{5,6}$/;
            const phonePattern = /^\d{10}$/;

            if (!addressLine2Input.value.trim()) {
                displayMessage('Address Line 2 (Area/Locality) is required.', 'error', 'settingsMessages');
                return;
            }
            if (zipCodeInput && !zipCodePattern.test(zipCodeInput.value)) {
                displayMessage('Invalid Zip Code format. Must be 5 or 6 digits.', 'error', 'settingsMessages');
                return;
            }
            if (phoneInput && !phonePattern.test(phoneInput.value)) {
                displayMessage('Invalid Phone Number format. Must be 10 digits.', 'error', 'settingsMessages');
                return;
            }

            handleFormSubmission(event, '/api/save_shipping_info', null, 'settingsMessages');
        });
    }

    const continueShoppingBtnSettings = document.getElementById('continueShoppingBtnSettings');
    if (continueShoppingBtnSettings) {
        continueShoppingBtnSettings.addEventListener('click', () => {
            window.location.href = 'products.html';
        });
    }


    const csvImportForm = document.getElementById('csvImportForm');
    if (csvImportForm) {
        csvImportForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fileInput = document.getElementById('csvFile');
            const file = fileInput.files[0];
            const importMessagesDiv = document.getElementById('importMessages');
            const importErrorsDiv = document.getElementById('importErrors');

            if (importMessagesDiv) {
                importMessagesDiv.style.display = 'none';
                importMessagesDiv.textContent = '';
            }
            if (importErrorsDiv) {
                importErrorsDiv.style.display = 'none';
                importErrorsDiv.innerHTML = '';
            }

            if (!file) {
                displayMessage('Please select a CSV file to upload.', 'error', 'importMessages');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                displayMessage('Uploading and importing products...', 'info', 'importMessages');
                showLoadingOverlay('Importing products...', 'spinner');
                const response = await fetch('/api/import_products', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    hideLoadingOverlay('Import successful!', 'success');
                    displayMessage(data.message, 'success', 'importMessages');
                    if (data.errors && data.errors.length > 0) {
                        if (importErrorsDiv) {
                            importErrorsDiv.style.display = 'block';
                            const ul = document.createElement('ul');
                            data.errors.forEach(error => {
                                const li = document.createElement('li');
                                li.textContent = error;
                                ul.appendChild(li);
                            });
                            importErrorsDiv.appendChild(ul);
                        }
                        displayMessage('Some rows had errors. See details below.', 'error', 'importMessages');
                    }
                    fileInput.value = '';
                } else {
                    hideLoadingOverlay('Import failed!', 'error');
                    displayMessage(data.message, 'error', 'importMessages');
                    if (data.errors && data.errors.length > 0) {
                        if (importErrorsDiv) {
                            importErrorsDiv.style.display = 'block';
                            const ul = document.createElement('ul');
                            data.errors.forEach(error => {
                                const li = document.createElement('li');
                                li.textContent = error;
                                ul.appendChild(li);
                            });
                            importErrorsDiv.appendChild(ul);
                        }
                    }
                }
            } catch (error) {
                console.error('Error during CSV import:', error);
                hideLoadingOverlay('Network error!', 'error');
                displayMessage('An unexpected error occurred during import. Please check server logs.', 'error', 'importMessages');
            }
        });
    }

    // Admin Dashboard Product Management Logic (Not Google Sheets specific)
    async function renderAdminProducts() {
        const productsTableBody = document.getElementById('productsTableBody');
        const noExistingProductsMessage = document.getElementById('noExistingProductsMessage');
        const existingProductsMessages = document.getElementById('existingProductsMessages');

        if (!productsTableBody || !existingProductsMessages) { // noExistingProductsMessage is optional for this check
            console.warn("renderAdminProducts: Required admin product management elements not found.");
            return;
        }

        productsTableBody.innerHTML = '<tr><td colspan="6" class="no-products-message">Loading products...</td></tr>';
        showLoadingOverlay('Loading products for admin...', 'spinner');
        displayMessage('Loading products...', 'info', 'existingProductsMessages');
        if (noExistingProductsMessage) noExistingProductsMessage.style.display = 'none';

        try {
            const response = await fetch('/api/admin/get_all_products');
            const data = await response.json();

            if (!data.success) {
                hideLoadingOverlay('Failed to load products.', 'error');
                displayMessage(data.message || 'Failed to load products for admin.', 'error', 'existingProductsMessages');
                productsTableBody.innerHTML = '<tr><td colspan="6" class="no-products-message">Error loading products.</td></tr>';
                if (noExistingProductsMessage) noExistingProductsMessage.style.display = 'block';
                return;
            }

            const products = data.products;
            if (products.length === 0) {
                hideLoadingOverlay('No products found.', 'info');
                displayMessage('No products found in the system.', 'info', 'existingProductsMessages');
                productsTableBody.innerHTML = '<tr><td colspan="6" class="no-products-message">No products found.</td></tr>';
                if (noExistingProductsMessage) noExistingProductsMessage.style.display = 'block';
            } else {
                hideLoadingOverlay('Products loaded.', 'success');
                displayMessage('', '', 'existingProductsMessages');
                productsTableBody.innerHTML = '';

                products.forEach(product => {
                    const row = document.createElement('tr');
                    row.dataset.productId = product.id; // Add data attribute for easy access
                    row.innerHTML = `
                        <td>${product.id}</td>
                        <td><img src="${product.image_url || 'https://placehold.co/80x80/cccccc/000000?text=No+Image'}" alt="${product.name || 'Product Image'}"></td>
                        <td>${product.name || 'Unknown Product'}</td>
                        <td>₹${parseFloat(product.price).toFixed(2)}</td>
                        <td>${product.stock}</td>
                        <td>
                            <div class="actions-buttons">
                                <button class="btn btn-edit" data-product-id="${product.id}">Edit</button>
                                <button class="btn btn-delete" data-product-id="${product.id}">Delete</button>
                            </div>
                        </td>
                    `;
                    productsTableBody.appendChild(row);
                });
                addAdminProductEventListeners();
            }
        } catch (error) {
            console.error('renderAdminProducts: Error fetching all products:', error);
            hideLoadingOverlay('Network error loading products.', 'error');
            displayMessage('Network error loading products. Please try again.', 'error', 'existingProductsMessages');
            productsTableBody.innerHTML = '<tr><td colspan="6" class="no-products-message">Failed to load products due to network error.</td></tr>';
            if (noExistingProductsMessage) noExistingProductsMessage.style.display = 'block';
        }
    }

    function addAdminProductEventListeners() {
        document.querySelectorAll('.product-table .btn-edit').forEach(button => {
            button.removeEventListener('click', handleEditProduct); // Prevent duplicate listeners
            button.addEventListener('click', handleEditProduct);
        });
        document.querySelectorAll('.product-table .btn-delete').forEach(button => {
            button.removeEventListener('click', handleDeleteProduct); // Prevent duplicate listeners
            button.addEventListener('click', handleDeleteProduct);
        });
    }

    async function handleAddProduct(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        
        showLoadingOverlay('Adding product...', 'spinner');
        displayMessage('Adding product...', 'info', 'productFormMessages');

        try {
            const response = await fetch('/api/admin/add_product', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                hideLoadingOverlay(data.message, 'success');
                displayMessage(data.message, 'success', 'productFormMessages');
                form.reset(); // Clear form after successful submission
                renderAdminProducts(); // Re-render the product list
            } else {
                hideLoadingOverlay(data.message || 'Failed to add product.', 'error');
                displayMessage(data.message || 'Failed to add product.', 'error', 'productFormMessages');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            hideLoadingOverlay('Network error adding product.', 'error');
            displayMessage('Network error adding product. Please try again.', 'error', 'productFormMessages');
        }
    }

    async function handleEditProduct(event) {
        const productId = event.target.dataset.productId;
        // In a real app, you'd fetch product data and populate the form for editing.
        // For now, we'll just log and show a message.
        displayMessage(`Edit functionality for product ID ${productId} is not yet implemented.`, 'info', 'existingProductsMessages');
        console.log(`Edit product ID: ${productId}`);
    }

    async function handleDeleteProduct(event) {
        const productId = event.target.dataset.productId;
        const confirmDelete = confirm('Are you sure you want to delete this product?'); // Using confirm for simplicity

        if (!confirmDelete) {
            return;
        }

        showLoadingOverlay(`Deleting product ID ${productId}...`, 'spinner');
        displayMessage(`Deleting product ID ${productId}...`, 'info', 'existingProductsMessages');

        try {
            const response = await fetch(`/api/admin/delete_product/${productId}`, {
                method: 'POST', // Or DELETE if your API supports it
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (data.success) {
                hideLoadingOverlay(data.message, 'success');
                displayMessage(data.message, 'success', 'existingProductsMessages');
                renderAdminProducts(); // Re-render the product list
            } else {
                hideLoadingOverlay(data.message || 'Failed to delete product.', 'error');
                displayMessage(data.message || 'Failed to delete product.', 'error', 'existingProductsMessages');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            hideLoadingOverlay('Network error deleting product.', 'error');
            displayMessage('Network error deleting product. Please try again.', 'error', 'existingProductsMessages');
        }
    }


    // NEW: Admin Order Management Logic for DB (Not Google Sheets specific)
    async function renderAdminOrders() {
        const ordersTableBody = document.getElementById('ordersTableBody');
        const noOrdersFoundMessage = document.getElementById('noOrdersFound');
        const orderManagementMessages = document.getElementById('orderManagementMessages');

        if (!ordersTableBody || !noOrdersFoundMessage || !orderManagementMessages) {
            console.warn("renderAdminOrders: Required admin order management elements not found.");
            return;
        }

        ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading orders...</td></tr>';
        showLoadingOverlay('Loading all orders...', 'spinner'); // Show loading overlay
        displayMessage('Loading all orders...', 'info', 'orderManagementMessages');
        noOrdersFoundMessage.style.display = 'none';

        try {
            const response = await fetch('/api/admin/get_all_orders');
            const data = await response.json();

            if (!data.success) {
                hideLoadingOverlay('Failed to load orders.', 'error'); // Hide with error message
                displayMessage(data.message || 'Failed to load orders for admin.', 'error', 'orderManagementMessages');
                ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Error loading orders.</td></tr>';
                noOrdersFoundMessage.style.display = 'block';
                return;
            }

            const orders = data.orders;
            if (orders.length === 0) {
                hideLoadingOverlay('No orders found.', 'info'); // Hide with info message
                displayMessage('No orders found in the system.', 'info', 'orderManagementMessages');
                ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No orders found.</td></tr>';
                noOrdersFoundMessage.style.display = 'block';
            } else {
                hideLoadingOverlay('Orders loaded.', 'success'); // Hide with success message
                displayMessage('', '', 'orderManagementMessages');
                ordersTableBody.innerHTML = '';

                orders.forEach(order => {
                    const orderDate = new Date(order.order_date).toLocaleString();
                    
                    const orderItemsHtml = order.items.map(item => `
                        <li>${item.product_name || 'Unknown Product'} (${item.quantity} x ₹${parseFloat(item.product_price).toFixed(2)})</li>
                    `).join('');

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${order.id}</td>
                        <td>${order.customer_username}<br><small>${order.customer_email}</small></td>
                        <td>${orderDate}</td>
                        <td>₹${parseFloat(order.total_amount).toFixed(2)}</td>
                        <td>
                            <select class="order-status-select" data-order-id="${order.id}">
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </td>
                        <td>${order.payment_method ? order.payment_method.toUpperCase() : 'N/A'}</td>
                        <td>
                            ${order.full_name}<br>
                            ${order.address_line1}, ${order.address_line2}${order.address_line3 ? ', ' + order.address_line3 : ''}<br>
                            ${order.city}, ${order.state} - ${order.zip_code}<br>
                            ${order.phone}
                        </td>
                        <td><ul class="order-items-admin-list">${orderItemsHtml}</ul></td>
                    `;
                    ordersTableBody.appendChild(row);
                });
                addAdminOrderEventListeners();
            }
        } catch (error) {
            console.error('renderAdminOrders: Error fetching all orders:', error);
            hideLoadingOverlay('Network error loading orders.', 'error'); // Hide with network error message
            displayMessage('Network error loading orders. Please try again.', 'error', 'orderManagementMessages');
            ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Failed to load orders due to network error.</td></tr>';
            noOrdersFoundMessage.style.display = 'block';
        }
    }

    function addAdminOrderEventListeners() {
        document.querySelectorAll('.order-status-select').forEach(selectElement => {
            selectElement.removeEventListener('change', handleOrderStatusChange);
            selectElement.addEventListener('change', handleOrderStatusChange);
        });
    }

    async function handleOrderStatusChange(event) {
        const selectElement = event.target;
        const orderId = selectElement.dataset.orderId;
        const newStatus = selectElement.value;
        const originalStatus = selectElement.dataset.originalStatus || selectElement.options[selectElement.selectedIndex].textContent.toLowerCase();

        // Optimistic UI update
        const originalBadge = selectElement.closest('td').querySelector('.order-status-badge');
        if (originalBadge) {
            originalBadge.className = `order-status-badge ${newStatus}`;
            originalBadge.textContent = newStatus;
        }
        
        showLoadingOverlay(`Updating order #${orderId} status to ${newStatus}...`, 'spinner'); // Show loading overlay
        displayMessage(`Updating order #${orderId} status to ${newStatus}...`, 'info', 'orderManagementMessages');

        const formData = new FormData();
        formData.append('status', newStatus);

        try {
            const response = await fetch('/api/update_order_status', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                hideLoadingOverlay(data.message, 'success');
                displayMessage(data.message, 'success', 'orderManagementMessages');
            } else {
                // Revert optimistic UI update on failure
                selectElement.value = originalStatus;
                if (originalBadge) {
                    originalBadge.className = `order-status-badge ${originalStatus}`;
                    originalBadge.textContent = originalStatus;
                }
                hideLoadingOverlay(data.message || 'Failed to update status.', 'error'); // Hide with error message
                displayMessage(`Failed to update status for order #${orderId}: ${data.message || 'Unknown error'}`, 'error', 'orderManagementMessages');
            }
        } catch (error) {
            // Revert optimistic UI update on network error
            selectElement.value = originalStatus;
            if (originalBadge) {
                originalBadge.className = `order-status-badge ${originalStatus}`;
                originalBadge.textContent = originalStatus;
            }
            console.error(`handleOrderStatusChange: Network error updating status for order #${orderId}:`, error);
            hideLoadingOverlay('Network error updating status.', 'error'); // Hide with network error message
            displayMessage('Network error updating order status. Please try again.', 'error', 'orderManagementMessages');
        }
    }

    // --- Admin Sheets Specific Logic (Google Sheets) ---

    // For admin_sheets_products.html
    async function renderAdminSheetsProducts() {
        const productForm = document.getElementById('productForm');
        const productsTableBody = document.getElementById('productsTableBody');
        const saveProductBtn = document.getElementById('saveProductBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        let editingProductId = null; // To track if we are in edit mode

        if (!productForm || !productsTableBody || !saveProductBtn || !cancelEditBtn) {
            console.warn("renderAdminSheetsProducts: Required elements for product sheets not found. Skipping.");
            return;
        }

        productsTableBody.innerHTML = '<tr><td colspan="6">Loading products...</td></tr>';
        showLoadingOverlay('Loading products from sheet...', 'spinner');
        displayMessage('Loading products from sheet...', 'info', 'productMessages');

        try {
            const response = await fetch('/api/admin/sheets/products');
            const result = await response.json();

            if (response.ok && result.success) {
                hideLoadingOverlay('Products loaded from sheet.', 'success');
                productsTableBody.innerHTML = ''; // Clear loading message
                if (result.products.length === 0) {
                    productsTableBody.innerHTML = '<tr><td colspan="6">No products found in the Google Sheet.</td></tr>';
                    return;
                }

                result.products.forEach(product => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${product.id}</td>
                        <td><img src="${product.image_url || 'https://placehold.co/60x60/cccccc/000000?text=No+Image'}" alt="${product.name || 'Product Image'}"></td>
                        <td>${product.name || 'Unknown Product'}</td>
                        <td>₹${product.price ? parseFloat(product.price).toFixed(2) : '0.00'}</td>
                        <td>${product.stock || 0}</td>
                        <td class="product-actions">
                            <button class="btn edit-btn" data-id="${product.id}">Edit</button>
                            <button class="btn delete-btn" data-id="${product.id}">Delete</button>
                        </td>
                    `;
                    productsTableBody.appendChild(row);
                });
                attachAdminSheetsProductEventListeners();
            } else {
                hideLoadingOverlay(result.message || 'Failed to load products from sheet.', 'error');
                productsTableBody.innerHTML = `<tr><td colspan="6" class="message error">Failed to load products: ${result.message || 'Unknown error'}</td></tr>`;
                console.error('Failed to load products from sheet:', result.message);
            }
        } catch (error) {
            hideLoadingOverlay('An error occurred while loading products from sheet.', 'error');
            productsTableBody.innerHTML = '<tr><td colspan="6" class="message error">An error occurred while loading products.</td></tr>';
            console.error('Fetch error loading products from sheet:', error);
        }
    }

    function attachAdminSheetsProductEventListeners() {
        document.querySelectorAll('.product-list-table .edit-btn').forEach(button => {
            button.removeEventListener('click', editProductSheet);
            button.addEventListener('click', (e) => editProductSheet(e.target.dataset.id));
        });
        document.querySelectorAll('.product-list-table .delete-btn').forEach(button => {
            button.removeEventListener('click', deleteProductSheet);
            button.addEventListener('click', (e) => deleteProductSheet(e.target.dataset.id));
        });

        const productForm = document.getElementById('productForm');
        const saveProductBtn = document.getElementById('saveProductBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');

        if (productForm) {
            productForm.removeEventListener('submit', handleProductSheetFormSubmit);
            productForm.addEventListener('submit', handleProductSheetFormSubmit);
        }
        if (cancelEditBtn) {
            cancelEditBtn.removeEventListener('click', cancelProductSheetEdit);
            cancelEditBtn.addEventListener('click', cancelProductSheetEdit);
        }
    }

    let editingProductIdSheet = null; // Separate variable for sheets product editing

    async function editProductSheet(productId) {
        const productForm = document.getElementById('productForm');
        const saveProductBtn = document.getElementById('saveProductBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');

        showLoadingOverlay('Loading product for edit...', 'spinner');
        try {
            const response = await fetch('/api/admin/sheets/products'); // Fetch all to find by ID
            const result = await response.json();

            if (response.ok && result.success) {
                const productToEdit = result.products.find(p => p.id == productId);
                if (productToEdit) {
                    hideLoadingOverlay('Product loaded.', 'success');
                    document.getElementById('productId').value = productToEdit.id;
                    document.getElementById('productName').value = productToEdit.name;
                    document.getElementById('productDescription').value = productToEdit.description;
                    document.getElementById('productPrice').value = productToEdit.price;
                    document.getElementById('productImage').value = productToEdit.image_url;
                    document.getElementById('productStock').value = productToEdit.stock;

                    saveProductBtn.textContent = 'Update Product';
                    cancelEditBtn.style.display = 'inline-block';
                    editingProductIdSheet = productId;
                    displayMessage(`Editing product ID: ${productId}`, 'info', 'productMessages');
                } else {
                    hideLoadingOverlay('Product not found.', 'error');
                    displayMessage('Product not found for editing.', 'error', 'productMessages');
                }
            } else {
                hideLoadingOverlay(result.message || 'Failed to load product.', 'error');
                displayMessage(result.message || 'Failed to load product.', 'error', 'productMessages');
            }
        } catch (error) {
            hideLoadingOverlay('Error loading product for edit.', 'error');
            displayMessage('An error occurred loading product for edit.', 'error', 'productMessages');
            console.error('Fetch error during product edit load:', error);
        }
    }

    async function deleteProductSheet(productId) {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }

        showLoadingOverlay('Deleting product...', 'spinner');
        try {
            const response = await fetch(`/api/admin/sheets/products/${productId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok && result.success) {
                hideLoadingOverlay(result.message, 'success');
                displayMessage(result.message, 'success', 'productMessages');
                renderAdminSheetsProducts(); // Re-render table
            } else {
                hideLoadingOverlay(result.message || 'Failed to delete product.', 'error');
                displayMessage(result.message || 'Failed to delete product.', 'error', 'productMessages');
                console.error('Product deletion failed:', result.message);
            }
        } catch (error) {
            hideLoadingOverlay('An error occurred during product deletion.', 'error');
            displayMessage('An error occurred during product deletion.', 'error', 'productMessages');
            console.error('Fetch error during product deletion:', error);
        }
    }

    async function handleProductSheetFormSubmit(e) {
        e.preventDefault();
        const productForm = document.getElementById('productForm');
        const saveProductBtn = document.getElementById('saveProductBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const formData = new FormData(productForm);
        let endpoint = '/api/admin/sheets/products';
        let method = 'POST';
        let successMessage = 'Product added successfully!';

        if (editingProductIdSheet) {
            endpoint = `/api/admin/sheets/products/${editingProductIdSheet}`;
            method = 'PUT';
            successMessage = 'Product updated successfully!';
        }

        showLoadingOverlay('Saving product...', 'spinner');
        saveProductBtn.disabled = true;

        try {
            const response = await fetch(endpoint, {
                method: method,
                body: formData
            });
            const result = await response.json();

            if (response.ok && result.success) {
                hideLoadingOverlay(successMessage, 'success');
                displayMessage(successMessage, 'success', 'productMessages');
                productForm.reset();
                saveProductBtn.textContent = 'Add Product';
                cancelEditBtn.style.display = 'none';
                editingProductIdSheet = null;
                renderAdminSheetsProducts(); // Re-render table
            } else {
                hideLoadingOverlay(result.message || 'Product save failed.', 'error');
                displayMessage(result.message || 'Product save failed.', 'error', 'productMessages');
                console.error('Product save failed:', result.message);
            }
        } catch (error) {
            hideLoadingOverlay('An error occurred while saving product.', 'error');
            displayMessage('An error occurred while saving product.', 'error', 'productMessages');
            console.error('Fetch error during product save:', error);
        } finally {
            saveProductBtn.disabled = false;
        }
    }

    function cancelProductSheetEdit() {
        const productForm = document.getElementById('productForm');
        const saveProductBtn = document.getElementById('saveProductBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        productForm.reset();
        saveProductBtn.textContent = 'Add Product';
        cancelEditBtn.style.display = 'none';
        editingProductIdSheet = null;
        displayMessage('Edit cancelled.', 'info', 'productMessages');
    }

    // For admin_sheets_orders.html
    async function renderAdminSheetsOrders() {
        const ordersTableBody = document.getElementById('ordersTableBody');
        const statusOptions = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

        if (!ordersTableBody) {
            console.warn("renderAdminSheetsOrders: Required elements for order sheets not found. Skipping.");
            return;
        }

        ordersTableBody.innerHTML = '<tr><td colspan="8">Loading orders...</td></tr>';
        showLoadingOverlay('Loading orders from sheet...', 'spinner');
        displayMessage('Loading orders from sheet...', 'info', 'orderMessages');

        try {
            const response = await fetch('/api/admin/sheets/orders');
            const result = await response.json();

            if (response.ok && result.success) {
                hideLoadingOverlay('Orders loaded from sheet.', 'success');
                ordersTableBody.innerHTML = ''; // Clear loading message
                if (result.orders.length === 0) {
                    ordersTableBody.innerHTML = '<tr><td colspan="8">No orders found in the Google Sheet.</td></tr>';
                    return;
                }

                result.orders.forEach(order => {
                    const row = document.createElement('tr');
                    const shippingAddress = `
                        ${order.full_name || 'N/A'}<br>
                        ${order.address_line1 || 'N/A'}<br>
                        ${order.address_line2 || 'N/A'}${order.address_line3 ? ', ' + order.address_line3 : ''}<br>
                        ${order.city || 'N/A'}, ${order.state || 'N/A'} - ${order.zip_code || 'N/A'}<br>
                        Phone: ${order.phone || 'N/A'}
                    `;
                    const orderItemsHtml = `
                        <ul>
                            ${order.items.map(item => `<li>${item.name || 'Unknown Item'} x ${item.quantity} (₹${item.price ? parseFloat(item.price).toFixed(2) : '0.00'})</li>`).join('')}
                        </ul>
                    `;

                    row.innerHTML = `
                        <td>${order.id}</td>
                        <td>${order.customer_username || 'N/A'} (${order.customer_email || 'N/A'})</td>
                        <td>${new Date(order.order_date).toLocaleDateString()} ${new Date(order.order_date).toLocaleTimeString()}</td>
                        <td>₹${order.total_amount ? parseFloat(order.total_amount).toFixed(2) : '0.00'}</td>
                        <td>
                            <select class="order-status-select" data-order-id="${order.id}">
                                ${statusOptions.map(status => `
                                    <option value="${status}" ${order.status === status ? 'selected' : ''}>
                                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                                    </option>
                                `).join('')}
                            </select>
                        </td>
                        <td>${order.payment_method || 'N/A'}</td>
                        <td>${shippingAddress}</td>
                        <td class="order-items-list-cell">${orderItemsHtml}</td>
                    `;
                    ordersTableBody.appendChild(row);
                });
                attachAdminSheetsOrderEventListeners();
            } else {
                hideLoadingOverlay(result.message || 'Failed to load orders from sheet.', 'error');
                ordersTableBody.innerHTML = `<tr><td colspan="8" class="message error">Failed to load orders: ${result.message || 'Unknown error'}</td></tr>`;
                console.error('Failed to load orders from sheet:', result.message);
            }
        } catch (error) {
            hideLoadingOverlay('An error occurred while loading orders from sheet.', 'error');
            ordersTableBody.innerHTML = '<tr><td colspan="8" class="message error">An error occurred while loading orders.</td></tr>';
            console.error('Fetch error loading orders from sheet:', error);
        }
    }

    function attachAdminSheetsOrderEventListeners() {
        document.querySelectorAll('.order-list-table .order-status-select').forEach(select => {
            select.removeEventListener('change', updateOrderSheetStatus);
            select.addEventListener('change', (e) => updateOrderSheetStatus(e.target.dataset.orderId, e.target.value));
        });
    }

    async function updateOrderSheetStatus(orderId, newStatus) {
        showLoadingOverlay(`Updating order #${orderId} status to ${newStatus}...`, 'spinner');
        try {
            const formData = new FormData();
            formData.append('status', newStatus);

            const response = await fetch(`/api/admin/sheets/orders/${orderId}/status`, {
                method: 'PUT',
                body: formData
            });
            const result = await response.json();

            if (response.ok && result.success) {
                hideLoadingOverlay(result.message, 'success');
                displayMessage(result.message, 'success', 'orderMessages');
                renderAdminSheetsOrders(); // Re-render the table to reflect changes
            } else {
                hideLoadingOverlay(result.message || 'Order status update failed.', 'error');
                displayMessage(result.message || 'Order status update failed.', 'error', 'orderMessages');
                console.error('Order status update failed:', result.message);
                renderAdminSheetsOrders(); // Re-render to revert if update failed
            }
        } catch (error) {
            hideLoadingOverlay('An error occurred during status update.', 'error');
            displayMessage('An error occurred during status update.', 'error', 'orderMessages');
            console.error('Fetch error during status update:', error);
            renderAdminSheetsOrders(); // Re-render on network error
        }
    }


    // --- Initializations and Event Listeners on DOM Load ---

    // Initial check for login status
    checkLoginStatus().then(() => {
        const adminDashboardLink = document.querySelector('#profileDropdownContent a[href="/admin/dashboard.html"]');
        isAdminUser = (adminDashboardLink !== null); // This might need to be refined if admin status is only backend

        updateCartCount(); // Update cart count based on initial login status

        // --- Product Page Specific Logic (Moved from products.html inline script) ---
        // Check if we are on the products page
        if (document.querySelector('.product-listing-section')) {
            const productGrid = document.getElementById('productGrid');
            const productSearchInput = document.getElementById('productSearchInput');
            const productSearchBtn = document.getElementById('productSearchBtn');

            // Function to render products (now called from here)
            async function renderProducts(query = '') {
                productGrid.innerHTML = '<p>Loading products...</p>'; // Clear existing products/message
                try {
                    // Fetching from sheets API - this should always work regardless of login
                    const response = await fetch(`/api/admin/sheets/products?query=${encodeURIComponent(query)}`); 
                    const result = await response.json();

                    if (response.ok && result.success) {
                        productGrid.innerHTML = ''; // Clear loading message
                        if (result.products.length === 0) {
                            productGrid.innerHTML = `<p>${result.message || 'No products found.'}</p>`;
                            return;
                        }

                        result.products.forEach(product => {
                            const productCard = document.createElement('div');
                            productCard.className = 'product-card';
                            productCard.dataset.productId = product.id; 
                            productCard.innerHTML = `
                                <img src="${product.image_url || 'https://placehold.co/300x200/cccccc/000000?text=No+Image'}" alt="${product.name || 'Product Image'}">
                                <div class="product-info">
                                    <h3>${product.name || 'Unknown Product'}</h3>
                                    <p>${product.description || 'No description available.'}</p>
                                    <div class="product-price">₹${(product.price !== undefined && product.price !== null) ? parseFloat(product.price).toFixed(2) : '0.00'}</div>
                                    <div class="product-stock">Stock: ${(product.stock !== undefined && product.stock !== null) ? product.stock : 'N/A'}</div>
                                    
                                    <button class="btn btn-add-to-cart"
                                            data-product-id="${product.id}"
                                            data-product-name="${product.name || 'Unknown Product'}"
                                            data-product-price="${product.price || '0.00'}"
                                            data-product-stock="${product.stock || '0'}"
                                            style="display: block;">Add to Cart</button>
                                    
                                    <div class="quantity-controls-product-card" style="display: none;">
                                        <button class="quantity-btn-product-card decrease-quantity-product-card" data-product-id="${product.id}">-</button>
                                        <span class="product-quantity-display" data-product-id="${product.id}">0</span>
                                        <button class="quantity-btn-product-card increase-quantity-product-card" data-product-id="${product.id}">+</button>
                                    </div>
                                </div>
                            `;
                            productGrid.appendChild(productCard);
                        });
                        // Attach listeners after all products are rendered
                        attachAddToCartListeners();
                        attachProductCardQuantityListeners(); 
                        loadProductStates(); // Load initial state for all product cards based on login
                    } else {
                        productGrid.innerHTML = `<p class="message error">${result.message || 'Failed to load products.'}</p>`;
                        console.error('Failed to load products:', result.message);
                    }
                } catch (error) {
                    productGrid.innerHTML = '<p class="message error">An error occurred while loading products.</p>';
                    console.error('Fetch error loading products:', error);
                }
            }

            // Attach event listeners for "Add to Cart" buttons
            function attachAddToCartListeners() {
                document.querySelectorAll('.btn-add-to-cart').forEach(button => {
                    button.removeEventListener('click', handleAddToCart); 
                    button.addEventListener('click', handleAddToCart);
                });
            }

            // Function to attach event listeners for quantity controls on product cards
            function attachProductCardQuantityListeners() {
                document.querySelectorAll('.quantity-btn-product-card').forEach(button => {
                    button.removeEventListener('click', handleProductCardQuantityChange);
                    button.addEventListener('click', handleProductCardQuantityChange);
                });
            }

            // Search functionality
            productSearchBtn.addEventListener('click', () => {
                const query = productSearchInput.value.trim();
                renderProducts(query);
            });

            productSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    productSearchBtn.click();
                }
            });

            // Initial render of products on page load for products.html
            renderProducts();
        }
        // --- End Product Page Specific Logic ---


        if (document.getElementById('cartItemsContainer')) {
            renderCartPage();

            const continueShoppingBtn = document.getElementById('continueShoppingBtn');
            if (continueShoppingBtn) {
                continueShoppingBtn.addEventListener('click', () => { window.location.href = 'products.html'; });
            }
            const proceedToCheckoutBtn = document.getElementById('proceedToCheckoutBtn');
            if (proceedToCheckoutBtn) {
                proceedToCheckoutBtn.addEventListener('click', () => {
                    window.location.href = 'checkout.html';
                });
            }
        }

        if (document.querySelector('.checkout-page-content')) {
            renderOrderSummary('checkoutMessages');
            loadShippingInfo();
        }

        if (document.querySelector('.payment-page-content')) {
            renderOrderSummary('paymentMessages');
            const defaultPaymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
            if (defaultPaymentMethodRadio) {
                showPaymentMethod(defaultPaymentMethodRadio.value + 'PaymentSection');
            } else {
                showPaymentMethod('cardPaymentSection');
            }
        }

        if (document.querySelector('.order-history-page-content')) {
            renderOrderHistory();
        }

        if (document.querySelector('.settings-page-content')) {
            loadUserSettings();
        }

        if (document.querySelector('.order-confirmation-section')) {
            renderOrderConfirmationPage();
        }

        if (document.querySelector('.manage-orders-content')) {
            renderAdminOrders();
        }

        // Check if we are on the admin_sheets_products.html page
        if (document.querySelector('.admin-sheets-container') && document.getElementById('productForm')) {
            renderAdminSheetsProducts();
        }

        // Check if we are on the admin_sheets_orders.html page
        if (document.querySelector('.admin-sheets-container') && document.querySelector('.order-list-table')) {
            renderAdminSheetsOrders();
        }
    }); // End of checkLoginStatus().then()
});
