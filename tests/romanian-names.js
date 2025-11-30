/**
 * Romanian Names Generator
 * Provides lists of common Romanian first names and surnames
 */

const firstNamesMale = [
  'Andrei', 'Alexandru', 'Adrian', 'Bogdan', 'Catalin', 'Constantin', 'Cristian', 'Daniel', 
  'Dragos', 'Dumitru', 'Eduard', 'Florin', 'Gabriel', 'George', 'Gheorghe', 'Ion', 'Ionut', 
  'Iulian', 'Laurentiu', 'Liviu', 'Lucian', 'Marian', 'Marius', 'Mihai', 'Mircea', 'Nicolae', 
  'Ovidiu', 'Paul', 'Petru', 'Radu', 'Razvan', 'Robert', 'Sergiu', 'Silviu', 'Sorin', 'Stefan', 
  'Tiberiu', 'Valentin', 'Vasile', 'Victor', 'Viorel', 'Vlad'
];

const firstNamesFemale = [
  'Adriana', 'Alexandra', 'Alina', 'Ana', 'Andreea', 'Angela', 'Bianca', 'Camelia', 'Carmen', 
  'Catalina', 'Claudia', 'Corina', 'Cristina', 'Dana', 'Daniela', 'Delia', 'Diana', 'Elena', 
  'Elisabeta', 'Florina', 'Gabriela', 'Georgeta', 'Georgiana', 'Ioana', 'Irina', 'Iulia', 
  'Laura', 'Loredana', 'Lucia', 'Maria', 'Mariana', 'Mihaela', 'Mirela', 'Monica', 'Nicoleta', 
  'Oana', 'Paula', 'Raluca', 'Roxana', 'Simona', 'Stefania', 'Valentina', 'Veronica', 'Violeta'
];

const surnames = [
  'Popescu', 'Ionescu', 'Popa', 'Pop', 'Radu', 'Dumitru', 'Stan', 'Stoica', 'Gheorghe', 'Matei', 
  'Ciobanu', 'Constantin', 'Serban', 'Moldovan', 'Dobre', 'Diaconu', 'Munteanu', 'Rus', 'Iancu', 
  'Ilie', 'Toma', 'Vasile', 'Nistor', 'David', 'Dinu', 'Georgescu', 'Ionita', 'Mocanu', 'Oprea', 
  'Sava', 'Stanciu', 'Tudor', 'Voicu', 'Albu', 'Barbu', 'Bratu', 'Costea', 'Florea', 'Grigore', 
  'Lupu', 'Manole', 'Marin', 'Mihai', 'Neagu', 'Negrea', 'Petre', 'Pintea', 'Rotaru', 'Sandu', 
  'Stefan', 'Tanase', 'Ungureanu', 'Vlad', 'Zaharia'
];

/**
 * Generate a random Romanian name
 * @param {string} gender - 'M' or 'F' (optional, random if not provided)
 * @returns {object} - { firstName, lastName, fullName, gender }
 */
function generateRomanianName(gender) {
  if (!gender) {
    gender = Math.random() > 0.5 ? 'M' : 'F';
  }
  
  const firstNameList = gender === 'M' ? firstNamesMale : firstNamesFemale;
  const firstName = firstNameList[Math.floor(Math.random() * firstNameList.length)];
  const lastName = surnames[Math.floor(Math.random() * surnames.length)];
  
  return {
    firstName,
    lastName,
    fullName: `${lastName} ${firstName}`,
    gender
  };
}

module.exports = {
  generateRomanianName,
  firstNamesMale,
  firstNamesFemale,
  surnames
};
