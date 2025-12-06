// Auth animation script - only for login/signup component
document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".auth-wrapper");
  const LoginLink = document.querySelector(".SignInLink");
  const RegisterLink = document.querySelector(".SignUpLink");

  if (RegisterLink) {
    RegisterLink.addEventListener("click", () => {
      if (container) {
        container.classList.add("active");
      }
    });
  }

  if (LoginLink) {
    LoginLink.addEventListener("click", () => {
      if (container) {
        container.classList.remove("active");
      }
    });
  }
});
