import * as express from "express";
import * as cors from "cors";
import { Request, Response } from "express";
import { Connection, createConnection } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";

createConnection().then((db) => {
  const productRepository = db.getRepository(Product);
  amqp.connect(
    "amqps://aqqgrxxw:pjCak9u579rAIFJRRtZJy3FkNEGFwBEq@beaver.rmq.cloudamqp.com/aqqgrxxw",
    (error0, connection) => {
      if (error0) throw error0;

      connection.createChannel((error1, channel) => {
        if (error1) throw error1;
        const app = express();

        app.use(
          cors({
            origin: ["http://localhost:3000"],
          })
        );

        app.use(express.json());

        app.get("/api/products", async (req: Request, res: Response) => {
          const products = await productRepository.find();
          res.json(products);
        });

        app.post("/api/products", async (req: Request, res: Response) => {
          const product = await productRepository.create(req.body);
          const result = await productRepository.save(product);
          channel.sendToQueue(
            "product_created",
            Buffer.from(JSON.stringify(result))
          );
          return res.send(result);
        });

        app.get("/api/products/:id", async (req: Request, res: Response) => {
          const product = await productRepository.findOne(req.params.id);
          return res.send(product);
        });

        app.put("/api/products/:id", async (req: Request, res: Response) => {
          const product = await productRepository.findOne(req.params.id);
          productRepository.merge(product, req.body);
          const result = await productRepository.save(product);
          channel.sendToQueue(
            "product_updated",
            Buffer.from(JSON.stringify(result))
          );
          return res.send(product);
        });

        app.delete("/api/products/:id", async (req: Request, res: Response) => {
          const result = await productRepository.delete(req.params.id);
          channel.sendToQueue("product_deleted", Buffer.from(req.params.id));
          return res.send(result);
        });

        app.post(
          "/api/products/:id/like",
          async (req: Request, res: Response) => {
            const product = await productRepository.findOne(req.params.id);
            product.likes++;
            const result = await productRepository.save(product);
            return res.send(result);
          }
        );

        const PORT = process.env.PORT || 8000;

        app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
        process.on("beforeExit", () => {
          console.log("closing connection....");
          connection.close();
        });
      });
    }
  );
}).catch((error)=>{
  console.log("Error: " + error.message)
} );
