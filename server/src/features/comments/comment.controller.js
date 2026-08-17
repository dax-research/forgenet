import Comment from "./comment.model.js";

// Create comment
export const createComment = async (req, res) => {
    try {
        const comment = await Comment.create(req.body);

        res.status(201).json({
            success: true,
            message: "Comment created successfully",
            comment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get comments of a post
export const getCommentsByPost = async (req, res) => {
    try {
        const comments = await Comment.find({
            post: req.params.postId
        })
            .populate("author", "name profileImage")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            comments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Update comment
export const updateComment = async (req, res) => {
    try {
        const comment = await Comment.findByIdAndUpdate(
            req.params.id,
            {
                content: req.body.content
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Comment updated successfully",
            comment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Delete comment
export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findByIdAndDelete(
            req.params.id
        );

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Comment deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};