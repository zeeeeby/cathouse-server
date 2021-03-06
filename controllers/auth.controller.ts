import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sequelize from '../db';
import { CustomError } from '../error/CustomError';
import { User, UserRole, Role } from '../models/models';
import { Roles } from '../roles';
import { getRole } from './someQueries';
import userController from './user.controller';

const generateTokens = (payload) => {
    const accessToken = jwt.sign({ ...payload }, process.env.SECRET_KEY, {
        expiresIn: '1h',
    });
    const refreshToken = jwt.sign({ ...payload }, process.env.SECRET_KEY, {
        expiresIn: '20d',
    });

    return {
        accessToken,
        refreshToken,
    };
};

class AuthController {
    async signUp(req, res, next) {
        const { username, password, first_name, last_name, avatar_url } =
            req.body;

        if (!username?.length || !password?.length) {
            return next(
                CustomError.unauthorized('Incorrect username or password')
            );
        }
        if (!last_name?.length || !first_name?.length) {
            return next(CustomError.unauthorized('Incorrect user data'));
        }
        try {
            const candidate = await User.findOne({
                where: { username: '@' + username },
            });

            if (candidate) {
                return next(
                    new CustomError(
                        409,
                        'User with this username already exists'
                    )
                );
            }

            const hashedPassword = await bcrypt.hash(password, 5);
            const user = await User.create({
                username: '@' + username,
                password: hashedPassword,
                first_name,
                last_name,
                avatar_url,
            });
            const role = await Role.findOne({
                where: { role_id: Roles.USER },
            });
            await UserRole.create({
                user_id: user.id,
                role_id: role.role_id,
            });
            const tokens = generateTokens({ id: user.id });

            res.cookie('refresh_token', tokens.refreshToken, {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
            });

            return res.json({ token: tokens.accessToken });
        } catch (error) {
            next(CustomError.internal(error.message));
        }
    }

    async signIn(req, res, next) {
        const { username, password } = req.body;
        const user = await User.findOne({
            where: { username: '@' + username },
        });
        if (!user) {
            return next(CustomError.notFound('User was not found'));
        }
        let comparePassword = bcrypt.compareSync(password, user.password);
        if (!comparePassword) {
            return next(CustomError.unauthorized('Could not sign in'));
        }
        try {
            const tokens = generateTokens({ id: user.id });

            res.cookie('refresh_token', tokens.refreshToken, {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
            });

            return res.json({ token: tokens.accessToken });
        } catch (error) {
            next(CustomError.internal(error.message));
        }
    }

    async refreshToken(req, res, next) {
        try {
            const token = req.cookies['refresh_token'];
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            const tokens = generateTokens({ id: decoded.id });
            res.cookie('refresh_token', tokens.refreshToken, {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
            });
            return res.json({
                token: tokens.accessToken,
            });
        } catch (e) {
            next(CustomError.unauthorized(e));
        }
    }

    async signOut(req, res, next) {
        res.cookie('refresh_token', '', {
            maxAge: 0,
            httpOnly: true,
            sameSite: 'none',
            secure: true,
        });
        return res.json({
            message: 'Signed out successfuly',
        });
    }

    checkAuth = () => async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            console.log(token);
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            req.token = token;
            req.user = decoded;
            next();
        } catch (e) {
            return next(CustomError.unauthorized('Unauthorized'));
        }
    };

    checkRole = (roles: Roles[]) => async (req, res, next) => {
        const role = await getRole(req.user.id);

        if (!roles.includes(role.role)) {
            next(CustomError.forbidden(`Permission denied`));
        }
        next();
    };

    async verifyUserName(req, res, next) {
        try {
            const username = req.query.username;
            if (username) {
                const user = await User.findOne({
                    where: { username: '@' + req.query.username },
                });
                if (user) {
                    return next(new CustomError(409, 'User already exists'));
                }
                res.json(user);
            } else {
                return next(CustomError.badRequest(''));
            }
        } catch (e) {
            next(CustomError.unauthorized('Unauthorized'));
        }
    }
}

export default new AuthController();
