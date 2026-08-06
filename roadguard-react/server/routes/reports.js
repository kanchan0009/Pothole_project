import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'report-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Get all reports with optional filters & pagination
router.get('/', optionalAuthenticateToken, (req, res) => {
  try {
    const { category, status, severity, search, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const { total, reports } = db.queryReports({
      category,
      status,
      severity,
      search,
      page: pageNum,
      limit: limitNum
    });

    let userVotedSet = new Set();
    if (req.user) {
      userVotedSet = db.getUserVotedReportIds(req.user.id);
    }

    const enrichedReports = reports.map(r => {
      const author = db.findUserById(r.user_id);
      const comments = db.getCommentsForReport(r.id);
      return {
        ...r,
        author_name: author ? author.name : 'Community Reporter',
        author_avatar: author ? author.avatar : null,
        comments_count: comments.length,
        has_voted: userVotedSet.has(r.id)
      };
    });

    res.json({
      reports: enrichedReports,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single report with comments
router.get('/:id', optionalAuthenticateToken, (req, res) => {
  try {
    const reportId = Number(req.params.id);
    const report = db.findReportById(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const author = db.findUserById(report.user_id);
    const comments = db.getCommentsForReport(reportId);
    let hasVoted = false;

    if (req.user) {
      hasVoted = db.hasUserVoted(reportId, req.user.id);
    }

    res.json({
      report: {
        ...report,
        author_name: author ? author.name : 'Community Reporter',
        author_avatar: author ? author.avatar : null,
        has_voted: hasVoted,
        comments
      }
    });
  } catch (err) {
    console.error('Error fetching report details:', err);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
});

// Submit a new report
router.post('/', authenticateToken, upload.single('photo'), (req, res) => {
  const { title, description, category, severity, location, latitude, longitude } = req.body;

  if (!title || !description || !category || !severity || !location) {
    return res.status(400).json({ error: 'Title, description, category, severity, and location are required' });
  }

  try {
    let img_url = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600';
    if (req.file) {
      img_url = `/uploads/${req.file.filename}`;
    } else if (req.body.img_url) {
      img_url = req.body.img_url;
    }

    const newReport = db.createReport({
      user_id: req.user.id,
      title,
      description,
      category,
      severity,
      location,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      img_url
    });

    db.addNotification({
      user_id: req.user.id,
      title: 'Report Submitted',
      message: `Your report "${title}" has been successfully logged.`,
      type: 'success'
    });

    res.status(201).json({ message: 'Report submitted successfully', report: newReport });
  } catch (err) {
    console.error('Error creating report:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Update report status (admin/officer)
router.put('/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Pending', 'Under Review', 'In Progress', 'Resolved'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const report = db.findReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updated = db.updateReportStatus(req.params.id, status);

    if (report.user_id) {
      db.addNotification({
        user_id: report.user_id,
        title: 'Report Status Updated',
        message: `Your report "${report.title}" status changed to ${status}.`,
        type: 'info'
      });
    }

    res.json({ message: 'Report status updated successfully', report: updated });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// Toggle vote on report
router.post('/:id/vote', authenticateToken, (req, res) => {
  try {
    const result = db.toggleVote(req.params.id, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: result.has_voted ? 'Vote added' : 'Vote removed', ...result });
  } catch (err) {
    console.error('Error voting on report:', err);
    res.status(500).json({ error: 'Failed to vote on report' });
  }
});

// Add comment to report
router.post('/:id/comments', authenticateToken, (req, res) => {
  const { text } = req.body;
  const reportId = Number(req.params.id);

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  try {
    const user = db.findUserById(req.user.id);
    const newComment = db.addComment({
      report_id: reportId,
      user_id: req.user.id,
      author_name: user ? user.name : 'Anonymous User',
      author_avatar: user ? user.avatar : null,
      text: text.trim()
    });

    res.status(201).json({ message: 'Comment added', comment: newComment });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
