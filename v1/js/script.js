
//menu hamburguesa

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.header__menu-toggle');
    const menu = document.querySelector('.header__menu');

    menuToggle.addEventListener('click', () => {
        menu.classList.toggle('header__menu--active'); // Activa o desactiva el menú
        menuToggle.classList.toggle('open'); // Añade la animación al botón hamburguesa
    });
});





  


//work indice

document.addEventListener("DOMContentLoaded", () => {
    const filterLinks = document.querySelectorAll(".portfolio__filter a");
    const galleryItems = document.querySelectorAll(".gallery__item");

    filterLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();

            // Actualizar la clase activa
            document.querySelector(".portfolio__filter .current").classList.remove("current");
            link.classList.add("current");

            // Obtener el filtro seleccionado
            const filterValue = link.getAttribute("data-filter");

            // Filtrar elementos
            galleryItems.forEach(item => {
                if (filterValue === "*" || item.classList.contains(filterValue.substring(1))) {
                    item.style.display = "block";
                    // Breve animación
                    item.style.opacity = "0";
                    setTimeout(() => {
                        item.style.opacity = "1";
                    }, 100); // Delay transición
                } else {
                    item.style.display = "none";
                }
            });
        });
    });
});

// Animación form contacto

document.addEventListener("DOMContentLoaded", () => {
    const inputs = document.querySelectorAll(".input-wrapper input, .input-wrapper textarea");

    inputs.forEach(input => {
        // Agregar clase 'active' al hacer focus o si tiene texto
        input.addEventListener("focus", () => {
            input.parentNode.classList.add("active");
        });

        // Quitar clase 'active' al perder focus si el campo está vacío
        input.addEventListener("blur", () => {
            if (input.value === "") {
                input.parentNode.classList.remove("active");
            }
        });
    });
});

// About me foto
document.addEventListener("DOMContentLoaded", () => {
    const squares = document.getElementById("photo-yo");

    document.addEventListener("mousemove", (event) => {
        if (squares) {
            let posX = event.clientX - window.innerWidth / 2;
            let posY = event.clientY - window.innerHeight / 2;

            squares.style.transform = "translate(" + posX * 0.04 + "%, " + posY * 0.04 + "%)";
        }
    });
});






