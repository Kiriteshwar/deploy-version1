document.getElementById("login-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    console.log('Attempting login with:', { email }); // Debug log

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        console.log('Response status:', response.status); // Debug log

        const data = await response.json();
        console.log('Response data:', data); // Debug log

        if (response.ok && data.token) {
            localStorage.setItem("auth_token", data.token);
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_data", JSON.stringify(data));
            
            // Store user ID and name for filtering purposes
            if (data.user && data.user._id) {
                localStorage.setItem("user_id", data.user._id);
                console.log('Stored user_id:', data.user._id);
            }
    
            // if (data.user && data.user.name) {
            //     localStorage.setItem("username", data.user.name);
            //     console.log('Stored username:', data.user.name);
            // }
            // Note: user_name is set by dashboard.js after successful login
           
            window.location.href = "dashboard.html";
        } else {
            alert(data.message || "Login failed. Please check your credentials.");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("Something went wrong. Please try again later.");
    }
});


