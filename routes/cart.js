const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// GET /cart - কার্টের ডেটা দেখানো
router.get('/', (req, res) => {
    const cartFilePath = path.join(__dirname, '../data/cart.json');
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        if (err) {
            // যদি cart.json ফাইল না থাকে বা পড়তে সমস্যা হয়
            console.error('Error reading cart data:', err);
            // প্রাথমিক অবস্থায় cart.json না থাকলে একটি খালি অ্যারে ব্যবহার করুন
            // অথবা যদি আপনি চান, একটি এরর পেজ দেখান।
            // এখানে ধরে নিচ্ছি খালি কার্ট দিয়ে শুরু করা যেতে পারে।
            if (err.code === 'ENOENT') { // ফাইল না থাকলে
                console.log('cart.json not found, starting with empty cart.');
                const productsFilePath = path.join(__dirname, '../data/products.json');
                fs.readFile(productsFilePath, 'utf8', (err, productsData) => {
                    if (err) {
                        console.error('Error reading products data (for empty cart):', err);
                        res.status(500).send('Internal Server Error');
                        return;
                    }
                    const products = JSON.parse(productsData) || [];
                    res.render('cart', { cartItems: [], products: products }); // খালি কার্ট সহ রেন্ডার করুন
                });
                return;
            } else {
                res.status(500).send('Internal Server Error');
                return;
            }
        }

        let cartItems = [];
        try {
            cartItems = JSON.parse(data);
        } catch (parseErr) {
            console.error('Error parsing cart data:', parseErr);
            res.status(500).send('Error parsing cart data');
            return;
        }

        const productsFilePath = path.join(__dirname, '../data/products.json');
        fs.readFile(productsFilePath, 'utf8', (err, productsData) => {
            if (err) {
                console.error('Error reading products data:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            let products = [];
            try {
                products = JSON.parse(productsData);
            } catch (parseErr) {
                console.error('Error parsing products data:', parseErr);
                res.status(500).send('Error parsing products data');
                return;
            }
            
            // নিশ্চিত করুন যে product.id বিদ্যমান আছে before comparison
            const cartItemsWithDetails = cartItems.map(cartItem => {
                const product = products.find(product => product.id === cartItem.productId);
                if (product) {
                    return {
                        id: product.id,
                        product_title: product.product_title,
                        product_price: product.product_price,
                        product_description: product.product_description,
                        image_path: product.image_path,
                        quantity: cartItem.quantity
                    };
                } else {
                    // যদি কার্টে এমন কোনো প্রোডাক্ট আইডি থাকে যা products.json এ নেই
                    console.warn(`Product with ID ${cartItem.productId} not found in products.json.`);
                    return null; // অথবা অন্য কোনো ডিফল্ট অবজেক্ট
                }
            }).filter(item => item !== null); // null আইটেমগুলো বাদ দিন

            res.render('cart', { cartItems: cartItemsWithDetails });
        });
    });
});

// POST /cart/add - কার্টে পণ্য যোগ করা
router.post('/add', (req, res) => {
    const productId = req.body.productId; // এটি নিশ্চিত করুন যে আপনার ফর্ম বা AJAX রিকোয়েস্ট 'productId' পাঠাচ্ছে

    if (!productId) {
        return res.status(400).send('Product ID is required.');
    }

    const cartFilePath = path.join(__dirname, '../data/cart.json');
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        let cart = [];
        if (err) {
            if (err.code === 'ENOENT') {
                // ফাইল না থাকলে খালি কার্ট দিয়ে শুরু করুন
                console.log('cart.json not found, creating a new one.');
            } else {
                console.error('Error reading cart data:', err);
                return res.status(500).send('Internal Server Error');
            }
        } else {
            try {
                cart = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing cart data:', parseErr);
                return res.status(500).send('Error parsing existing cart data');
            }
        }

        const existingProductIndex = cart.findIndex(item => item.productId === productId);

        if (existingProductIndex !== -1) {
            cart[existingProductIndex].quantity++;
        } else {
            cart.push({ productId: productId, quantity: 1 });
        }

        fs.writeFile(cartFilePath, JSON.stringify(cart, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing cart data:', err);
                return res.status(500).send('Internal Server Error');
            }
            console.log('Product added to cart:', productId);
            // পণ্য যোগ করার পর কার্ট পেজে রিডাইরেক্ট করুন
            res.redirect('/cart'); // <<<--- এই লাইনটি পরিবর্তন করা হয়েছে
        });
    });
});

// POST /cart/increment - কার্টে পণ্যের পরিমাণ বাড়ানো
router.post('/increment', (req, res) => {
    const productId = req.body.productId;
    if (!productId) {
        return res.status(400).send('Product ID is required.');
    }

    const cartFilePath = path.join(__dirname, '../data/cart.json');
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        let cart = [];
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Internal Server Error');
        } else {
            try {
                cart = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing cart data:', parseErr);
                return res.status(500).send('Error parsing existing cart data');
            }
        }

        const itemIndex = cart.findIndex(item => item.productId === productId);
        if (itemIndex !== -1) {
            cart[itemIndex].quantity++;
            fs.writeFile(cartFilePath, JSON.stringify(cart, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing cart data:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.sendStatus(200); // সফল হলে 200 OK পাঠান
            });
        } else {
            res.status(404).send('Product not found in cart');
        }
    });
});

// POST /cart/decrement - কার্টে পণ্যের পরিমাণ কমানো
router.post('/decrement', (req, res) => {
    const productId = req.body.productId;
    if (!productId) {
        return res.status(400).send('Product ID is required.');
    }

    const cartFilePath = path.join(__dirname, '../data/cart.json');
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        let cart = [];
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Internal Server Error');
        } else {
            try {
                cart = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing cart data:', parseErr);
                return res.status(500).send('Error parsing existing cart data');
            }
        }

        const itemIndex = cart.findIndex(item => item.productId === productId);
        if (itemIndex !== -1) {
            if (cart[itemIndex].quantity > 1) {
                cart[itemIndex].quantity--;
                fs.writeFile(cartFilePath, JSON.stringify(cart, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('Error writing cart data:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    res.sendStatus(200);
                });
            } else {
                // যদি quantity 1 হয় এবং আরও কমানো হয়, তাহলে আইটেমটি মুছে ফেলুন
                cart.splice(itemIndex, 1);
                fs.writeFile(cartFilePath, JSON.stringify(cart, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('Error writing cart data:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    res.sendStatus(200);
                });
            }
        } else {
            res.status(404).send('Product not found in cart');
        }
    });
});

// POST /cart/delete - কার্ট থেকে পণ্য মোছা
router.post('/delete', (req, res) => {
    const productId = req.body.productId;
    if (!productId) {
        return res.status(400).send('Product ID is required.');
    }

    const cartFilePath = path.join(__dirname, '../data/cart.json');
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        let cart = [];
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Internal Server Error');
        } else {
            try {
                cart = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing cart data:', parseErr);
                return res.status(500).send('Error parsing existing cart data');
            }
        }

        const index = cart.findIndex(item => item.productId === productId);
        if (index !== -1) {
            cart.splice(index, 1);

            fs.writeFile(cartFilePath, JSON.stringify(cart, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing cart data:', err);
                    return res.status(500).send('Internal Server Error');
                }
                console.log('Item deleted from cart:', productId);
                res.sendStatus(200); // সফল হলে 200 OK পাঠান
            });
        } else {
            res.status(404).send('Item not found in cart');
        }
    });
});

module.exports = router;