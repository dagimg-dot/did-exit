# PDF Quiz Generator

A simple, powerful web application that converts PDF files with multiple choice questions into interactive quiz experiences using Google Generative AI.

## ✨ Features

- **PDF Upload**: Drag & drop or click to upload PDF files
- **AI-Powered Extraction**: Uses Google Gemini AI to extract ALL questions from PDFs
- **Progressive Loading**: First 10-20 questions appear immediately, more load in background
- **Smart Caching**: Previously processed PDFs load instantly from local storage
- **Interactive Quiz**: Navigate through questions with multiple choice answers
- **Dynamic Question Addition**: New questions appear seamlessly as they're processed
- **Real-time Feedback**: Immediate feedback on answers with explanations
- **Background Processing**: Continuous extraction without blocking the user interface
- **Comprehensive Results**: Detailed breakdown of performance with review mode
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Free Tier Optimized**: Intelligent batching and rate limiting for Google Gemini's free tier

## 🚀 Quick Start

1. **Clone or download** this repository
2. **Get a Google AI API key** from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. **Update the API key** in `js/ai-integration.js`:
   ```javascript
   this.apiKey = "YOUR_GOOGLE_AI_API_KEY_HERE";
   ```
4. **Open `index.html`** in your web browser
5. **Upload a PDF** and start creating quizzes!

## 🆓 Google Gemini Free Tier Benefits

Based on our research, the free tier is excellent for this use case:

### **Available Free Models:**
- ✅ **Gemini 2.0 Flash** (Recommended): 15 RPM, 1M TPM, 1,500 RPD
- ✅ **Gemini 1.5 Flash**: 15 RPM, 250K TPM, 500 RPD  
- ✅ **Gemini 2.5 Flash Preview**: 10 RPM, 250K TPM, 500 RPD
- ✅ **Gemini 1.5 Flash-8B**: 15 RPM, 250K TPM, 500 RPD

### **Generous Limits:**
- **1M token context window** - can handle very large PDFs!
- **No cost limitations** - completely free for moderate usage
- **500-1,500 requests per day** - plenty for most use cases
- **Automatic rate limiting** - built into the app

### **What This Means:**
- ✅ Process large PDFs with 100+ questions
- ✅ Extract ALL questions (no artificial limits)
- ✅ Perfect for educational and research use
- ✅ No hidden costs or surprise billing

## 🛠️ How It Works

### **Progressive Processing Architecture:**
1. **Upload PDF**: The app extracts text content from your PDF file
2. **Smart Analysis**: Content is analyzed and divided into optimal processing chunks
3. **Priority Processing**: First batch of 10-20 questions is extracted immediately (~10 seconds)
4. **Background Extraction**: Remaining questions are processed in background while you start the quiz
5. **Dynamic Updates**: New questions appear seamlessly as they're ready
6. **Intelligent Caching**: Previously processed PDFs load instantly from local storage
7. **Interactive Quiz**: Start quiz immediately, continue as new questions become available
8. **Results & Review**: Comprehensive performance analysis with all extracted questions

### **Technical Innovation:**
- **Batch Processing**: Large PDFs are intelligently split into manageable chunks
- **IndexedDB Storage**: Local caching for instant re-access of processed PDFs
- **Rate Limiting**: Conservative API usage to respect free tier limits
- **Progressive UX**: Users don't wait for full processing - quiz starts immediately

## 📁 Project Structure

```
pdf-quiz-generator/
├── index.html              # Main HTML structure with notifications
├── css/
│   ├── main.css            # Base styles and variables
│   ├── components.css      # UI components + notifications + progress indicators
│   └── quiz.css           # Quiz-specific styling
├── js/
│   ├── main.js            # Application controller (UPDATED for batch processing)
│   ├── file-uploader.js   # PDF upload handling
│   ├── pdf-processor.js   # PDF text extraction
│   ├── ai-integration.js  # Google AI integration (ENHANCED with chunking)
│   ├── quiz-manager.js    # Quiz logic + dynamic question addition (UPDATED)
│   ├── ui-components.js   # UI state + notifications + progress (ENHANCED)
│   ├── database-manager.js # IndexedDB wrapper for caching (NEW)
│   └── batch-processor.js # Smart chunking and progressive processing (NEW)
├── TESTING_GUIDE.md       # Comprehensive testing instructions (NEW)
├── IMPLEMENTATION_PLAN.md # Technical implementation details (NEW)
└── README.md              # This file (UPDATED)
```

## 🎯 Optimizations Applied

### **AI Integration Improvements:**
- **Smart Model Selection**: Automatically uses the best available free tier model
- **Rate Limiting**: Built-in protection against API limits
- **Enhanced Prompting**: Optimized to extract ALL questions, not just 10
- **Better Error Handling**: Graceful fallbacks and user-friendly messages
- **Token Optimization**: Efficiently uses the 1M token context window

### **Free Tier Strategy:**
- Uses Gemini 2.0 Flash as primary model (best free tier performance)
- Automatic fallback to other free models if needed
- Conservative rate limiting (12 RPM vs 15 RPM limit)
- Intelligent error handling for API limits

## 📊 Performance Expectations

### **PDF Processing:**
- **Small PDFs** (< 50 questions): ~5-10 seconds
- **Medium PDFs** (50-200 questions): ~10-20 seconds  
- **Large PDFs** (200+ questions): ~20-60 seconds
- **Very Large PDFs** (500+ questions): May require chunking

### **Daily Limits (Free Tier):**
- **~500-1,500 PDF extractions per day**
- **Perfect for educational use, research, and prototyping**
- **No cost - completely free!**

## 🔧 Technical Details

### **Models Used (Priority Order):**
1. `gemini-2.0-flash` - Best balance of speed and capability
2. `gemini-1.5-flash` - Reliable fallback option
3. `gemini-2.5-flash-preview` - Latest features
4. `gemini-1.5-flash-8b` - Fastest processing
5. `gemini-1.5-flash-latest` - Final fallback

### **Key Features:**
- **1M Token Context**: Can process very large documents
- **Automatic Rate Limiting**: Prevents API quota issues
- **Smart Chunking**: Handles PDFs larger than token limits
- **JSON Response Cleaning**: Robust parsing of AI responses
- **Progressive Enhancement**: Works even if AI fails

## 🚀 Scaling Options

### **If You Need More:**
- **Tier 1** (Enable billing): 2,000-4,000 RPM, 4M TPM
- **Cost**: ~$0.075 per 1M input tokens, $0.30 per 1M output tokens
- **Very affordable** for most educational and commercial use

### **Enterprise Features:**
- Context caching for repeated content
- Batch processing capabilities  
- Custom model fine-tuning
- Priority support and higher limits

## 🎓 Educational Use Cases

- **Teachers**: Convert exam PDFs into interactive quizzes
- **Students**: Practice with past papers and study materials
- **Trainers**: Create engaging training assessments
- **Researchers**: Analyze question banks and educational content

## 🤝 Contributing

This is a simple, standalone web application. Feel free to:
- Fork and modify for your needs
- Submit issues and suggestions
- Share improvements and optimizations
- Adapt for different AI providers

## 📝 License

Open source - use freely for educational and research purposes.

---

**Note**: This application is optimized for Google Gemini's free tier, making it accessible for educational use without any costs. The generous free tier limits make it perfect for schools, students, and researchers who need powerful AI capabilities without budget constraints. 