# PDF Quiz App

A simple web application that converts PDF files with multiple choice questions into interactive quiz experiences using AI.

## Features

- 📄 **PDF Upload**: Drag and drop or browse to upload PDF files
- 🤖 **AI Integration**: Uses Google Generative AI to extract and generate quiz questions
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- ✨ **Interactive Quiz**: Clean, modern quiz interface with progress tracking
- 📊 **Results Analysis**: Detailed results with explanations and review mode
- 🎯 **Answer Review**: Review your answers with correct/incorrect highlighting

## Project Structure

```
quiz-app/
├── index.html              # Main HTML file
├── css/
│   ├── main.css           # Base styles and layout
│   ├── components.css     # Reusable UI components
│   └── quiz.css          # Quiz-specific styles
├── js/
│   ├── main.js           # Main application controller
│   ├── file-uploader.js  # File upload and drag-drop
│   ├── pdf-processor.js  # PDF text extraction
│   ├── ai-integration.js # Google AI integration
│   ├── quiz-manager.js   # Quiz logic and navigation
│   └── ui-components.js  # UI components and state
└── README.md
```

## Setup Instructions

### 1. Basic Setup

1. Clone or download this project
2. Open `index.html` in a modern web browser
3. The app will work with mock data initially

### 2. Google AI Integration (Optional but Recommended)

To use real AI-powered question generation:

1. Get a Google AI API key:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key

2. Update the AI integration:
   - Open `js/ai-integration.js`
   - Replace `'YOUR_GOOGLE_AI_API_KEY_HERE'` with your actual API key
   - Save the file

### 3. Local Development Server (Recommended)

For best results, serve the files through a local web server:

```bash
# Using Python (if installed)
python -m http.server 8000

# Using Node.js (if installed)
npx http-server

# Using PHP (if installed)
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## How to Use

1. **Upload PDF**: Click "Browse Files" or drag and drop a PDF file containing multiple choice questions
2. **Processing**: The app will extract text from the PDF and generate interactive questions
3. **Take Quiz**: Answer the questions one by one using the navigation buttons
4. **View Results**: See your score, detailed breakdown, and explanations
5. **Review Answers**: Click "Review Answers" to see correct/incorrect answers highlighted

## Technical Details

### Dependencies

- **PDF.js**: For PDF text extraction (loaded from CDN)
- **Google Generative AI**: For question generation (optional)

### Browser Compatibility

- Modern browsers with ES6 module support
- Chrome, Firefox, Safari, Edge (recent versions)

### File Size Limits

- Maximum PDF size: 10MB
- Recommended: PDFs with clear text (not scanned images)

## Customization

### Styling

- Modify CSS custom properties in `css/main.css` to change colors
- Update component styles in `css/components.css`
- Customize quiz appearance in `css/quiz.css`

### AI Behavior

- Adjust prompts in `ai-integration.js` to change question generation
- Modify mock questions for demo purposes
- Add additional AI models or services

### Quiz Logic

- Change number of questions generated
- Modify scoring algorithms
- Add timer functionality
- Implement different question types

## API Configuration

The app currently supports Google's Generative AI (Gemini). To add your API key:

```javascript
// In js/ai-integration.js
this.apiKey = 'your-actual-api-key-here';
```

### Rate Limits

Be aware of Google AI API rate limits:
- Free tier: Limited requests per minute
- Consider implementing request queuing for large PDFs

## Troubleshooting

### Common Issues

1. **PDF not processing**: Ensure the PDF contains readable text (not scanned images)
2. **AI not working**: Check that your API key is correctly set
3. **Module errors**: Serve files through HTTP (not file://) protocol
4. **Styling issues**: Clear browser cache and reload

### Error Messages

- **"No text found in PDF"**: The PDF might be image-based or corrupted
- **"AI service error"**: Check API key and internet connection
- **"Failed to load PDF.js"**: Check internet connection for CDN access

## Future Enhancements

- [ ] Support for different question types (true/false, fill-in-the-blank)
- [ ] PDF text-to-speech for accessibility
- [ ] Export results to PDF/CSV
- [ ] Timed quiz mode
- [ ] Multiple PDF support
- [ ] Question difficulty analysis
- [ ] Progress saving and resume

## License

This project is open source. Feel free to modify and distribute as needed.

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Ensure you're using a modern browser
3. Verify your internet connection for CDN resources
4. Check that your PDF contains readable text 