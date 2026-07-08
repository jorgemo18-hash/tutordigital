// Registro de los 6 paneles — usado por la regresión visual y por los
// smoke tests. Los selectores de fondo (photo/veil) son los mismos que se
// verificaron a mano en la unificación de identidad visual; ver
// assets/shared/styles/components/bg-layers.css.

export const PANELS = [
  {
    name: "superadmin",
    path: "/assets/superadmin/index.html",
    photo: ".sa-photo",
    veil: ".sa-veil",
    pseudo: false,
  },
  {
    name: "admin",
    path: "/assets/admin/index.html",
    photo: ".av-photo",
    veil: ".av-veil",
    pseudo: false,
  },
  {
    name: "academia-admin",
    path: "/assets/academia/admin/index.html",
    photo: ".ac-photo",
    veil: ".ac-veil",
    pseudo: false,
  },
  {
    name: "academia-profesor",
    path: "/assets/academia/profesor/index.html",
    photo: ".ac-photo",
    veil: ".ac-veil",
    pseudo: false,
  },
  {
    name: "teacher",
    path: "/assets/teacher/index.html",
    photo: ".bgLayer",
    veil: ".bgLayer",
    pseudo: true,
  },
  {
    name: "student",
    path: "/assets/student/index.html",
    photo: ".bgLayer",
    veil: ".bgLayer",
    pseudo: true,
  },
];
