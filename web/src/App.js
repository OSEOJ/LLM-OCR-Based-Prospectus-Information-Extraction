import React from 'react';
import './App.css';
// import './App_original_backup.css';
// import FileConverter from './components/FileConverter';
// import FileConverter from './components/FileConverter_Refactored_Backup';
import FigmaFileConverter from './components/FigmaDesign/FigmaFileConverter';

function App() {
  return (
    <div className="App">
      <FigmaFileConverter />
    </div>
  );
}

export default App;
