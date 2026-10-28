const passwordInput = document.getElementById("password");
const togglePasswordButton = document.getElementById("toggle-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const toggleConfirmPasswordButton = document.getElementById("toggle-confirm-password");

const setPasswordVisibility = (input, button, isVisible) => {
    input.type = isVisible ? "text" : "password";
    button.setAttribute("aria-pressed", String(isVisible));
};

togglePasswordButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
        return;
    }
    togglePasswordButton.setPointerCapture(event.pointerId);
    setPasswordVisibility(passwordInput, togglePasswordButton, true);
});
togglePasswordButton.addEventListener("pointerup", () => setPasswordVisibility(passwordInput, togglePasswordButton, false));
togglePasswordButton.addEventListener("pointercancel", () => setPasswordVisibility(passwordInput, togglePasswordButton, false));

if (toggleConfirmPasswordButton) {
    toggleConfirmPasswordButton.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }
        toggleConfirmPasswordButton.setPointerCapture(event.pointerId);
        setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, true);
    });
    toggleConfirmPasswordButton.addEventListener("pointerup", () => setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, false));
    toggleConfirmPasswordButton.addEventListener("pointercancel", () => setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, false));
    toggleConfirmPasswordButton.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
            setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, true);
        }
    });
    toggleConfirmPasswordButton.addEventListener("keyup", (event) => {
        if (event.key === " " || event.key === "Enter") {
            setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, false);
        }
    });
}
window.addEventListener("blur", () => {
    setPasswordVisibility(passwordInput, togglePasswordButton, false);
    if (confirmPasswordInput) setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, false);
});
