const express = require('express');
const db = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const { parsePositiveInteger } = require('../utils/validation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const localUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for image uploads (local storage)
const upload = multer({
  storage: localUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// PUBLIC: Get lessons by unit ID
router.get('/unit/:unitId', async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.unitId);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid unit id' });
    }
    const lessons = await db.all(
      'SELECT id, unit_id, title, created_at FROM lessons WHERE unit_id = ? ORDER BY created_at ASC',
      [parsed.value]
    );
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUBLIC: Get single lesson with full content
router.get('/:id', async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.id);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const id = parsed.value;
    const [lesson, videos, images, files] = await Promise.all([
      db.get('SELECT * FROM lessons WHERE id = ?', [id]),
      db.all('SELECT id, lesson_id, video_url, position, size, explanation FROM videos WHERE lesson_id = ? ORDER BY display_order ASC', [id]).catch(() => []),
      db.all('SELECT id, lesson_id, image_path, position, size, caption FROM images WHERE lesson_id = ? ORDER BY display_order ASC', [id]).catch(() => []),
      db.all('SELECT id, lesson_id, file_type, url, title, description FROM files WHERE lesson_id = ? ORDER BY display_order ASC', [id]).catch(() => [])
    ]);

    if (!lesson) {
      return res.status(404).json({ error: 'الدرس غير موجود' });
    }

    res.json({
      ...lesson,
      videos: videos || [],
      images: images || [],
      files: files || []
    });
  } catch (error) {
    console.error('Error in GET /api/lessons/:id:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ADMIN: Get all lessons (for admin panel)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const lessons = await db.all(`
      SELECT l.*, u.title as unit_title, u.term, u.class_id, c.name as class_name 
      FROM lessons l 
      JOIN units u ON l.unit_id = u.id 
      JOIN classes c ON u.class_id = c.id 
      ORDER BY c.display_order ASC, u.display_order ASC, l.created_at DESC
    `);
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching all lessons:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: Create lesson
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, unit_id, content, videos, images, files } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: 'عنوان الدرس مطلوب',
        code: 'TITLE_REQUIRED'
      });
    }

    const unitIdParsed = parsePositiveInteger(unit_id);
    if (!unitIdParsed.valid) {
      return res.status(400).json({
        error: 'الوحدة الدراسية مطلوبة',
        code: 'UNIT_ID_REQUIRED'
      });
    }
    const unit_idNum = unitIdParsed.value;
    const trimmed = title.trim();

    const arabicOnlyPattern = /^[\u0600-\u06FF\s]+$/;
    if (!arabicOnlyPattern.test(trimmed)) {
      return res.status(400).json({
        error: 'عنوان الدرس يجب أن يحتوي على أحرف عربية فقط',
        code: 'INVALID_CHARACTERS'
      });
    }

    const unitExists = await db.get('SELECT id FROM units WHERE id = ?', [unit_idNum]);
    if (!unitExists) {
      return res.status(404).json({
        error: 'الوحدة الدراسية غير موجودة',
        code: 'UNIT_NOT_FOUND'
      });
    }

    const existingLesson = await db.get(
      'SELECT id FROM lessons WHERE unit_id = ? AND title = ?',
      [unit_idNum, trimmed]
    );

    if (existingLesson) {
      return res.status(409).json({
        error: 'هذا العنوان موجود بالفعل في هذه الوحدة. يرجى اختيار عنوان آخر',
        code: 'DUPLICATE_LESSON_TITLE'
      });
    }

    const result = await db.run(
      'INSERT INTO lessons (title, unit_id, content, pptx_url, pdf_url) VALUES (?, ?, ?, ?, ?)',
      [trimmed, unit_idNum, content || '', null, null]
    );

    // Insert videos if provided
    if (videos && Array.isArray(videos)) {
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (v.video_url) {
          await db.run(
            'INSERT INTO videos (lesson_id, video_url, position, size, explanation, display_order) VALUES (?, ?, ?, ?, ?, ?)',
            [result.id, v.video_url, v.video_position || 'bottom', v.video_size || 'large', v.video_explanation || null, i]
          );
        }
      }
    }

    // Insert images if provided
    if (images && Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.image_path) {
          await db.run(
            'INSERT INTO images (lesson_id, image_path, position, size, caption, display_order) VALUES (?, ?, ?, ?, ?, ?)',
            [result.id, img.image_path, img.image_position || 'bottom', img.image_size || 'medium', img.image_caption || null, i]
          );
        }
      }
    }

    // Insert files if provided
    if (files && Array.isArray(files)) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.url) {
          await db.run(
            'INSERT INTO files (lesson_id, file_type, url, title, description, display_order) VALUES (?, ?, ?, ?, ?, ?)',
            [result.id, f.file_type || 'pdf', f.url, f.title || '', f.description || '', i]
          );
        }
      }
    }

    const [newLesson, lessonsVideos, lessonsImages, lessonsFiles] = await Promise.all([
      db.get('SELECT * FROM lessons WHERE id = ?', [result.id]),
      db.all('SELECT id, lesson_id, video_url, position, size, explanation FROM videos WHERE lesson_id = ? ORDER BY display_order ASC', [result.id]),
      db.all('SELECT id, lesson_id, image_path, position, size, caption FROM images WHERE lesson_id = ? ORDER BY display_order ASC', [result.id]),
      db.all('SELECT id, lesson_id, file_type, url, title, description FROM files WHERE lesson_id = ? ORDER BY display_order ASC', [result.id])
    ]);
    res.status(201).json({ ...newLesson, videos: lessonsVideos || [], images: lessonsImages || [], files: lessonsFiles || [] });
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: Update lesson
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const idParsed = parsePositiveInteger(req.params.id);
    if (!idParsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const id = idParsed.value;
    const { title, unit_id, content, videos, images, files } = req.body;
    const unitIdParsed = parsePositiveInteger(unit_id);
    if (!unitIdParsed.valid) {
      return res.status(400).json({ error: 'الوحدة الدراسية مطلوبة', code: 'UNIT_ID_REQUIRED' });
    }
    const unit_idNum = unitIdParsed.value;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: 'اسم الدرس مطلوب',
        code: 'TITLE_REQUIRED'
      });
    }

    const trimmedTitle = title.trim();

    const arabicPattern = /^[\u0600-\u06FF\s]+$/;
    if (!arabicPattern.test(trimmedTitle)) {
      return res.status(400).json({
        error: 'يجب أن يحتوي على أحرف عربية فقط',
        code: 'INVALID_CHARACTERS'
      });
    }

    const unitExists = await db.get('SELECT id FROM units WHERE id = ?', [unit_idNum]);
    if (!unitExists) {
      return res.status(404).json({
        error: 'الوحدة الدراسية غير موجودة',
        code: 'UNIT_NOT_FOUND'
      });
    }

    const existingLesson = await db.get(
      'SELECT id FROM lessons WHERE unit_id = ? AND title = ? AND id != ?',
      [unit_idNum, trimmedTitle, id]
    );

    if (existingLesson) {
      return res.status(409).json({
        error: 'هذا الاسم موجود بالفعل',
        code: 'DUPLICATE_LESSON_TITLE'
      });
    }

    let result;
    try {
      result = await db.run(
        'UPDATE lessons SET title = ?, unit_id = ?, content = ?, pptx_url = NULL, pdf_url = NULL WHERE id = ?',
        [trimmedTitle, unit_idNum, content || '', id]
      );
    } catch (updateError) {
      console.error('[ERROR] Lesson update failed:', updateError.message);
      return res.status(500).json({
        error: 'حدث خطأ في تحديث الدرس'
      });
    }

    if (result.changes === 0) {
      return res.status(404).json({ error: 'الدرس غير موجود' });
    }

    // Handle videos: delete old ones and insert new ones
    if (videos && Array.isArray(videos) && videos.length > 0) {
      try {
        // Delete old videos
        try {
          await db.run('DELETE FROM videos WHERE lesson_id = ?', [id]);
        } catch (delErr) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Could not delete old videos:', delErr.message);
          }
        }

        // Insert new videos
        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          if (v.video_url) {
            await db.run(
              'INSERT INTO videos (lesson_id, video_url, position, size, explanation, display_order) VALUES (?, ?, ?, ?, ?, ?)',
              [id, v.video_url, v.video_position || 'bottom', v.video_size || 'large', v.video_explanation || null, i]
            );
          }
        }
      } catch (videoError) {
        console.error('[ERROR] Video processing failed:', videoError.message);
      }
    }

    // Handle images: delete old ones and insert new ones
    if (images && Array.isArray(images) && images.length > 0) {
      try {
        // Delete old images
        try {
          await db.run('DELETE FROM images WHERE lesson_id = ?', [id]);
        } catch (delErr) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Could not delete old images:', delErr.message);
          }
        }

        // Insert new images
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (img.image_path) {
            await db.run(
              'INSERT INTO images (lesson_id, image_path, position, size, caption, display_order) VALUES (?, ?, ?, ?, ?, ?)',
              [id, img.image_path, img.image_position || 'bottom', img.image_size || 'medium', img.image_caption || null, i]
            );
          }
        }
      } catch (imageError) {
        console.error('[ERROR] Image processing failed:', imageError.message);
      }
    }

    // Handle files: delete old ones and insert new ones
    if (files && Array.isArray(files)) {
      try {
        try {
          await db.run('DELETE FROM files WHERE lesson_id = ?', [id]);
        } catch (delErr) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Could not delete old files:', delErr.message);
          }
        }

        // Insert new files
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.url) {
            await db.run(
              'INSERT INTO files (lesson_id, file_type, url, title, description, display_order) VALUES (?, ?, ?, ?, ?, ?)',
              [id, f.file_type || 'pdf', f.url, f.title || '', f.description || '', i]
            );
          }
        }
      } catch (fileError) {
        console.error('[ERROR] File processing failed:', fileError.message);
      }
    }

    const [updatedLesson, lessonsVideos, lessonsImages, lessonsFiles] = await Promise.all([
      db.get('SELECT * FROM lessons WHERE id = ?', [id]),
      db.all('SELECT id, lesson_id, video_url, position, size, explanation FROM videos WHERE lesson_id = ? ORDER BY display_order ASC', [id]).catch(() => []),
      db.all('SELECT id, lesson_id, image_path, position, size, caption FROM images WHERE lesson_id = ? ORDER BY display_order ASC', [id]).catch(() => []),
      db.all('SELECT id, lesson_id, file_type, url, title, description FROM files WHERE lesson_id = ? ORDER BY display_order ASC', [id]).catch(() => [])
    ]);
    res.json({ ...updatedLesson, videos: lessonsVideos || [], images: lessonsImages || [], files: lessonsFiles || [] });
  } catch (error) {
    console.error('[ERROR] Lesson update failed:', error.message);
    res.status(500).json({ error: 'حدث خطأ في تحديث الدرس' });
  }
});

// ADMIN: Upload image
router.post('/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم توفير ملف صورة', code: 'NO_FILE' });
    }
    const publicPath = `/uploads/${req.file.filename}`;
    res.json({ imagePath: publicPath });
  } catch (error) {
    console.error('[ERROR] Image upload failed:', error);
    res.status(500).json({
      error: 'فشل تحميل الصورة',
      code: 'UPLOAD_ERROR'
    });
  }
});

// ADMIN: Delete lesson
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.id);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const id = parsed.value;
    const result = await db.run('DELETE FROM lessons WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== QUESTIONS API ====================

// PUBLIC: Get questions for a lesson (for students taking quiz)
router.get('/:lessonId/questions', async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.lessonId);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const lessonId = parsed.value;
    const questions = await db.all(
      'SELECT id, lesson_id, question_text, option_a, option_b, option_c, option_d, display_order FROM questions WHERE lesson_id = ? ORDER BY display_order ASC',
      [lessonId]
    );
    // Note: correct_answer is NOT included for students
    res.json(questions || []);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUBLIC: Check answer for a question
router.post('/:lessonId/questions/:questionId/check', async (req, res) => {
  try {
    const lessonIdParsed = parsePositiveInteger(req.params.lessonId);
    const questionIdParsed = parsePositiveInteger(req.params.questionId);
    if (!lessonIdParsed.valid || !questionIdParsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson or question id' });
    }
    const questionId = questionIdParsed.value;
    const { answer } = req.body;
    if (answer === undefined || answer === null || String(answer).trim() === '') {
      return res.status(400).json({ error: 'الإجابة مطلوبة' });
    }

    const question = await db.get('SELECT correct_answer FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({ error: 'السؤال غير موجود' });
    }

    const isCorrect = String(answer).trim().toUpperCase() === question.correct_answer.toUpperCase();
    res.json({
      correct: isCorrect,
      correctAnswer: question.correct_answer
    });
  } catch (error) {
    console.error('Error checking answer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: Get questions with answers (for editing)
router.get('/:lessonId/questions/admin', authenticateToken, async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.lessonId);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const lessonId = parsed.value;
    const questions = await db.all(
      'SELECT * FROM questions WHERE lesson_id = ? ORDER BY display_order ASC',
      [lessonId]
    );
    res.json(questions || []);
  } catch (error) {
    console.error('Error fetching questions for admin:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: Add a question
router.post('/:lessonId/questions', authenticateToken, async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.lessonId);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const lessonId = parsed.value;
    const { question_text, option_a, option_b, option_c, option_d, correct_answer } = req.body;

    // Validation
    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (!['A', 'B', 'C', 'D'].includes(correct_answer.toUpperCase())) {
      return res.status(400).json({ error: 'الإجابة الصحيحة يجب أن تكون A أو B أو C أو D' });
    }

    // Get next display order
    const lastQuestion = await db.get(
      'SELECT MAX(display_order) as max_order FROM questions WHERE lesson_id = ?',
      [lessonId]
    );
    const displayOrder = (lastQuestion?.max_order || 0) + 1;

    const result = await db.run(
      'INSERT INTO questions (lesson_id, question_text, option_a, option_b, option_c, option_d, correct_answer, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [lessonId, question_text, option_a, option_b, option_c, option_d, correct_answer.toUpperCase(), displayOrder]
    );

    const newQuestion = await db.get('SELECT * FROM questions WHERE id = ?', [result.id]);
    res.status(201).json(newQuestion);
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: Update a question
router.put('/:lessonId/questions/:questionId', authenticateToken, async (req, res) => {
  try {
    const questionIdParsed = parsePositiveInteger(req.params.questionId);
    if (!questionIdParsed.valid) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const questionId = questionIdParsed.value;
    const { question_text, option_a, option_b, option_c, option_d, correct_answer } = req.body;

    // Validation
    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (!['A', 'B', 'C', 'D'].includes(correct_answer.toUpperCase())) {
      return res.status(400).json({ error: 'الإجابة الصحيحة يجب أن تكون A أو B أو C أو D' });
    }

    const result = await db.run(
      'UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ? WHERE id = ?',
      [question_text, option_a, option_b, option_c, option_d, correct_answer.toUpperCase(), questionId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'السؤال غير موجود' });
    }

    const updatedQuestion = await db.get('SELECT * FROM questions WHERE id = ?', [questionId]);
    res.json(updatedQuestion);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: Delete a question
router.delete('/:lessonId/questions/:questionId', authenticateToken, async (req, res) => {
  try {
    const parsed = parsePositiveInteger(req.params.questionId);
    if (!parsed.valid) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const questionId = parsed.value;
    const result = await db.run('DELETE FROM questions WHERE id = ?', [questionId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'السؤال غير موجود' });
    }

    res.json({ success: true, message: 'تم حذف السؤال' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
