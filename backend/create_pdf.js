const fs = require('fs');
const PDFDocument = require('pdfkit');

const doc = new PDFDocument({ margin: 50 });
doc.pipe(fs.createWriteStream('../Manplanner_Project_Summary.pdf'));

// Title
doc.font('Helvetica-Bold').fontSize(22).text('Manplanner', { align: 'center' });
doc.fontSize(14).text('A Full-Stack Task Management Application', { align: 'center' });
doc.moveDown(2);

// Abstract Heading
doc.font('Helvetica-Bold').fontSize(16).text('Project Abstract');
doc.moveDown(0.5);

// Abstract Body
const abstractText = 'Creating to-do lists and managing projects can often feel overwhelming when using tools that have too many complicated features or lack basic privacy. "Manplanner" is a modern web application built from the ground up to help people easily organize their daily tasks in a clean, distraction-free environment. \n\nManplanner solves the complexity by providing a sleek, highly responsive dashboard where users can securely register, log in, add tasks, set due dates, and track their priorities over time. The application features completely separate user accounts secured by JSON Web Tokens (JWT), meaning every individual user\'s personal data is kept safely encrypted in the server. It also includes an advanced Admin Panel where project managers can oversee registered users and total task counts across the system.\n\nThe project uses a completely custom Node.js and Express backend connected to a relational database. The frontend is designed with a premium "glassmorphism" aesthetic using purely standard HTML, CSS, and Vanilla JavaScript. By combining a lightweight and beautiful design with strong server-side security, Manplanner is a fast and responsive tool that demonstrates exactly how modern full-stack websites are built, secured, and deployed to the cloud.';

doc.font('Helvetica').fontSize(12).text(abstractText, {
  align: 'justify',
  lineGap: 4
});

doc.moveDown(2);

// Tech Stack Heading
doc.font('Helvetica-Bold').fontSize(16).text('Technology Stack');
doc.moveDown(0.5);

// Tech Stack List
const techStack = [
  '• Frontend: HTML5, CSS3, Vanilla JavaScript',
  '• Backend: Node.js, Express.js API',
  '• Database: SQLite (Development) / PostgreSQL (Production)',
  '• Security & Authentication: RESTful API, JSON Web Tokens (JWT), bcrypt',
  '• Cloud Hosting: Render Platform'
];

doc.font('Helvetica').fontSize(12);
techStack.forEach(item => {
  doc.text(item, { lineGap: 6 });
});

doc.end();
console.log('PDF Generated');
